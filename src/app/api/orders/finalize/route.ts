import { NextResponse } from 'next/server';

import { finalizePaidOrder } from '@/lib/order';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const ref = typeof body?.paymentRef === 'string' ? body.paymentRef : null;
  if (!ref) return NextResponse.json({ ok: false, error: 'missing_ref' }, { status: 400 });

  const result = await finalizePaidOrder(ref);
  if (!result.ok) return NextResponse.json(result, { status: 400 });

  return NextResponse.json(result);
}
