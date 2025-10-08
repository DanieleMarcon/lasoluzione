// src/app/api/payments/checkout/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recalcCartTotal } from '@/lib/cart';
import { createRevolutOrder } from '@/lib/revolut';
import { sendOrderPaymentEmail } from '@/lib/mailer';
import { encodeRevolutPaymentMeta, mergeEmailStatus, parsePaymentRef } from '@/lib/paymentRef';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

function getBaseUrl() {
  // togli l'eventuale trailing slash
  const fromEnv = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '');
  return fromEnv || 'http://localhost:3000';
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const parsed = z.object({ orderId: z.string().min(1) }).safeParse(body ?? {});
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Missing orderId' }, { status: 400 });
    }
    const { orderId } = parsed.data;

    // Recupero ordine
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });
    }

    // Ricalcolo totale dal carrello (fonte di verità)
    const totalCents = await recalcCartTotal(order.cartId);

    // Allineo l'ordine se necessario (non obbligatorio ma utile)
    if (order.totalCents !== totalCents) {
      await prisma.order.update({
        where: { id: order.id },
        data: { totalCents },
      });
    }

    const publicKey = process.env.NEXT_PUBLIC_REVOLUT_PUBLIC_KEY;
    const configWarning = publicKey
      ? undefined
      : 'NEXT_PUBLIC_REVOLUT_PUBLIC_KEY non configurata: il checkout verrà aperto in una nuova finestra.';
    if (configWarning) {
      console.warn('[payments][checkout] missing public checkout key');
    }

    // Costruisco i redirect URL (utili per hosted fallback Revolut)
    const base = getBaseUrl();
    const returnUrl = process.env.PAY_RETURN_URL || `${base}/checkout/return`;
    const cancelUrl = process.env.PAY_CANCEL_URL || `${base}/checkout/cancel`;

    // Flusso a 0€
    if (totalCents <= 0) {
      const paymentRef = 'FREE';
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'paid', paymentRef },
      });
      const redirectUrl = `${returnUrl}?orderId=${encodeURIComponent(order.id)}`;
      return NextResponse.json({
        ok: true,
        data: { orderId: order.id, amountCents: totalCents, redirectUrl, paymentRef, configWarning },
      });
    }

    // Crea ordine su Revolut
    const description = `Prenotazione #${order.id} - Bar La Soluzione`;

    const parsedRef = parsePaymentRef(order.paymentRef);
    if (parsedRef.kind === 'revolut' && parsedRef.meta.checkoutPublicId) {
      return NextResponse.json({
        ok: true,
        data: {
          orderId: order.id,
          amountCents: totalCents,
          paymentRef: parsedRef.meta.orderId,
          checkoutPublicId: parsedRef.meta.checkoutPublicId,
          hostedPaymentUrl: parsedRef.meta.hostedPaymentUrl,
          email: parsedRef.meta.emailError ? { ok: false, error: parsedRef.meta.emailError } : { ok: true },
          configWarning,
        },
      });
    }

    const revolutOrder = await createRevolutOrder({
      amountMinor: totalCents,
      currency: 'EUR',
      merchantOrderId: order.id,
      customer: { email: order.email, name: order.name },
      description,
      captureMode: 'automatic',
      returnUrl,
      cancelUrl,
    } as any);

    const baseMeta = {
      provider: 'revolut' as const,
      orderId: revolutOrder.paymentRef,
      checkoutPublicId: revolutOrder.checkoutPublicId,
      hostedPaymentUrl: revolutOrder.hostedPaymentUrl,
    };

    const emailResult = await sendOrderPaymentEmail({
      to: order.email,
      orderId: order.id,
      amountCents: totalCents,
      hostedPaymentUrl: baseMeta.hostedPaymentUrl,
    });

    if (!emailResult.ok) {
      console.warn('[payments][checkout] invio email non riuscito', emailResult.error || 'unknown_error');
    }

    const finalMeta = mergeEmailStatus(baseMeta, emailResult);

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'pending_payment',
        paymentRef: encodeRevolutPaymentMeta(finalMeta),
      },
    });

    return NextResponse.json({
      ok: true,
      data: {
        orderId: order.id,
        amountCents: totalCents,
        paymentRef: revolutOrder.paymentRef,
        checkoutPublicId: revolutOrder.checkoutPublicId,
        hostedPaymentUrl: finalMeta.hostedPaymentUrl,
        email: emailResult,
        configWarning,
      },
    });
  } catch (err) {
    console.error('[payments][checkout] error', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
