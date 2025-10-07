// src/app/api/payments/checkout/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { recalcCartTotal } from '@/lib/cart';
import { createRevolutOrder } from '@/lib/revolut';

export const dynamic = 'force-dynamic';

function getBaseUrl() {
  // togli l'eventuale trailing slash
  const fromEnv = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '');
  return fromEnv || 'http://localhost:3000';
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({} as any));
    const orderId = body?.orderId as string | undefined;
    if (!orderId) {
      return NextResponse.json({ ok: false, error: 'Missing orderId' }, { status: 400 });
    }

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

    // Costruisco i redirect URL
    const base = getBaseUrl();
    const returnUrl = process.env.PAY_RETURN_URL || `${base}/checkout/return`;
    const cancelUrl = process.env.PAY_CANCEL_URL || `${base}/checkout/cancel`;

    // Flusso a 0€
    if (totalCents <= 0) {
      const updated = await prisma.order.update({
        where: { id: orderId },
        data: { status: 'paid', paymentRef: 'FREE' },
      });
      const redirectUrl = `${returnUrl}?orderId=${encodeURIComponent(orderId)}&ref=FREE`;
      return NextResponse.json({
        ok: true,
        data: { mode: 'free', redirectUrl, orderId: updated.id },
      });
    }

    // Crea ordine su Revolut
    const description = `Prenotazione #${order.id} - Bar La Soluzione`;

    const { paymentRef, token } = await createRevolutOrder({
      amountMinor: totalCents,
      currency: 'EUR',
      merchantOrderId: order.id,
      customer: { email: order.email, name: order.name },
      description,
      captureMode: 'automatic',
      // redirect per hosted page / fallback
      returnUrl,
      cancelUrl,
    } as any);

    // Stato ordine in attesa pagamento
    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'pending_payment', paymentRef },
    });

    return NextResponse.json({
      ok: true,
      data: { mode: 'widget', orderId: order.id, paymentRef, token, returnUrl, cancelUrl },
    });
  } catch (err) {
    console.error('[payments][checkout] error', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
