import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { retrieveRevolutOrder, isRevolutPaid } from '@/lib/revolut';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const orderId = searchParams.get('orderId');
    const ref = searchParams.get('ref') || undefined;

    if (!orderId) return NextResponse.json({ ok: false, error: 'Missing orderId' }, { status: 400 });

    const order = await prisma.order.findUnique({ where: { id: orderId } });
    if (!order) return NextResponse.json({ ok: false, error: 'Order not found' }, { status: 404 });

    // Idempotency shortcut
    if (order.status === 'paid') {
      return NextResponse.json({ ok: true, data: { status: 'paid' } });
    }

    // FREE or API verify
    if (order.paymentRef === 'FREE') {
      await prisma.order.update({ where: { id: orderId }, data: { status: 'paid' } });
      return NextResponse.json({ ok: true, data: { status: 'paid' } });
    }

    const paymentRef = order.paymentRef || ref;
    if (!paymentRef) {
      return NextResponse.json({ ok: true, data: { status: 'pending' } });
    }

    const remote = await retrieveRevolutOrder(paymentRef);
    const paid = isRevolutPaid(remote.state);

    if (paid) {
      await prisma.order.update({ where: { id: orderId }, data: { status: 'paid' } });
      return NextResponse.json({ ok: true, data: { status: 'paid' } });
    } else if (remote.state === 'failed' || remote.state === 'cancelled') {
      await prisma.order.update({ where: { id: orderId }, data: { status: 'failed' } });
      return NextResponse.json({ ok: true, data: { status: 'failed' } });
    }

    return NextResponse.json({ ok: true, data: { status: 'pending' } });
  } catch (err: any) {
    console.error('[payments][status] error', err);
    return NextResponse.json({ ok: false, error: 'Status error' }, { status: 500 });
  }
}
