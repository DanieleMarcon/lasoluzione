import { NextResponse } from 'next/server';

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

import { findOrderByReference, pollOrderStatus } from '@/lib/orders';

async function handleStatus(identifier: { orderId?: string | null; ref?: string | null }) {
  let orderId = identifier.orderId?.trim();
  const ref = identifier.ref?.trim();

  if (!orderId && ref) {
    const found = await findOrderByReference(ref);
    if (!found) {
      return NextResponse.json({ ok: false, error: 'order_not_found' }, { status: 404 });
    }
    orderId = found.id;
  }

  if (!orderId) {
    return NextResponse.json({ ok: false, error: 'missing_order' }, { status: 400 });
  }

  const result = await pollOrderStatus(orderId);
  if (result.status === 'not_found') {
    return NextResponse.json({ ok: false, error: 'order_not_found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true, data: { status: result.status, orderId } });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const orderId = searchParams.get('orderId') || searchParams.get('id');
  const ref = searchParams.get('ref') || searchParams.get('paymentRef');
  try {
    return await handleStatus({ orderId, ref });
  } catch (error) {
    console.error('[payments][status][GET] error', error);
    return NextResponse.json({ ok: false, error: 'status_error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const orderId = typeof body?.orderId === 'string' ? body.orderId : null;
    const ref = typeof body?.ref === 'string' ? body.ref : null;
    return await handleStatus({ orderId, ref });
  } catch (error) {
    console.error('[payments][status][POST] error', error);
    return NextResponse.json({ ok: false, error: 'status_error' }, { status: 500 });
  }
}
