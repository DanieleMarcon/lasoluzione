import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { retrieveRevolutOrder, isRevolutPaid } from '@/lib/revolut';
import { parsePaymentRef } from '@/lib/paymentRef';
import { getOrderByRef, markOrderPaid } from '@/lib/order';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const ref = searchParams.get('ref') || searchParams.get('paymentRef');

    if (!ref) return NextResponse.json({ ok: false, error: 'missing_ref' }, { status: 400 });

    const order = await getOrderByRef(ref);
    if (!order) return NextResponse.json({ ok: false, error: 'order_not_found' }, { status: 404 });

    if (order.status === 'paid') {
      return NextResponse.json({ ok: true, data: { status: 'completed' } });
    }

    if (order.status === 'failed') {
      return NextResponse.json({ ok: true, data: { status: 'failed' } });
    }

    const parsedRef = parsePaymentRef(order.paymentRef);

    if (parsedRef.kind === 'free' || ref.startsWith('FREE-')) {
      await markOrderPaid(ref);
      return NextResponse.json({ ok: true, data: { status: 'completed' } });
    }

    const paymentRef = (() => {
      if (order.providerRef) return order.providerRef;
      if (parsedRef.kind === 'revolut') return parsedRef.meta.orderId;
      if (parsedRef.kind === 'unknown' && parsedRef.raw) return parsedRef.raw;
      return ref;
    })();

    if (!paymentRef) {
      return NextResponse.json({ ok: true, data: { status: 'pending' } });
    }

    const remote = await retrieveRevolutOrder(paymentRef);
    const state = remote.state;

    if (isRevolutPaid(state)) {
      await prisma.order.update({ where: { id: order.id }, data: { status: 'paid', providerRef: paymentRef } });
      return NextResponse.json({ ok: true, data: { status: 'completed' } });
    }

    if (state === 'failed' || state === 'cancelled' || state === 'declined') {
      await prisma.order.update({ where: { id: order.id }, data: { status: 'failed', providerRef: paymentRef } });
      return NextResponse.json({ ok: true, data: { status: state } });
    }

    return NextResponse.json({ ok: true, data: { status: 'pending' } });
  } catch (err: any) {
    console.error('[payments][status] error', err);
    return NextResponse.json({ ok: false, error: String(err?.message || err) }, { status: 500 });
  }
}
