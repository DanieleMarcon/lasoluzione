import { NextResponse } from 'next/server';

import { finalizePaidOrder } from '@/lib/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const orderId = typeof body?.orderId === 'string' ? body.orderId : null;
  if (!orderId) return NextResponse.json({ ok: false, error: 'missing_order' }, { status: 400 });

  try {
    const order = await finalizePaidOrder(orderId);
    return NextResponse.json({ ok: true, orderId: order.id });
  } catch (error) {
    console.error('[api][orders][finalize] error', error);
    return NextResponse.json({ ok: false, error: 'finalize_failed' }, { status: 500 });
  }
}
