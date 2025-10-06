import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { createRevolutOrder } from '@/lib/revolut';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { orderId } = await req.json().catch(() => ({}));
    if (!orderId) {
      return NextResponse.json({ ok: false, error: 'Missing orderId' }, { status: 400 });
    }

    // Load order & recompute totals from items (if needed). Minimal version:
    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) {
      return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });
    }

    const totalCents = order.totalCents ?? 0;

    // Zero-euro flow: no gateway
    if (totalCents <= 0) {
      const updated = await prisma.order.update({
        where: { id: orderId },
        data: { status: 'paid', paymentRef: 'FREE' },
      });
      const redirectUrl = `${process.env.PAY_RETURN_URL}?orderId=${encodeURIComponent(orderId)}&ref=FREE`;
      return NextResponse.json({ ok: true, data: { mode: 'free', redirectUrl, orderId: updated.id } });
    }

    // Create Revolut order
    const description = `Prenotazione #${order.id} - Bar La Soluzione`;
    const successUrl = `${process.env.PAY_RETURN_URL}?orderId=${encodeURIComponent(order.id)}`;
    const cancelUrl = `${process.env.PAY_CANCEL_URL}?orderId=${encodeURIComponent(order.id)}`;

    const { paymentRef, publicId } = await createRevolutOrder({
      amountMinor: totalCents,
      currency: 'EUR',
      merchantOrderId: order.id,
      customer: { email: order.email, name: order.name },
      description,
      successUrl,
      cancelUrl,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: { status: 'pending_payment', paymentRef },
    });

    return NextResponse.json({
      ok: true,
      data: { mode: 'widget', orderId: order.id, paymentRef, publicId },
    });
  } catch (err: any) {
    console.error('[payments][checkout] error', err);
    return NextResponse.json({ ok: false, error: 'Checkout error' }, { status: 500 });
  }
}
