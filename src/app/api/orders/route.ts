import { NextResponse } from 'next/server';

import { OrderInput, createOrderFromCart, OrderWorkflowError } from '@/lib/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = OrderInput.safeParse(body ?? {});

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
    }

    const result = await createOrderFromCart(parsed.data);
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }

    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    if (error instanceof OrderWorkflowError) {
      console.warn('[api][orders] workflow error', error.message);
      return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
    }

    console.error('[api][orders] unexpected error', error);
    return NextResponse.json({ ok: false, error: 'unable_to_create_order' }, { status: 500 });
  }
}
