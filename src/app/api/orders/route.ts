import { NextResponse } from 'next/server';
import { z } from 'zod';

import { createOrderFromCart, OrderCheckoutError, toOrderDTO } from '@/lib/orders';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const checkoutSchema = z
  .object({
    token: z.string().min(1),
    email: z.string().email(),
    name: z.string().min(1),
    phone: z.string().trim().min(8, 'Telefono non valido'),
    notes: z.string().min(1).max(2000).optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = checkoutSchema.safeParse(body ?? {});

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
    }

    try {
      const order = await createOrderFromCart(parsed.data);
      const dto = toOrderDTO(order);

      return NextResponse.json({ ok: true, data: dto });
    } catch (error) {
      if (error instanceof OrderCheckoutError) {
        return NextResponse.json({ ok: false, error: error.message }, { status: error.status });
      }

      console.error('[POST /api/orders] order error', error);
      return NextResponse.json({ ok: false, error: 'Unable to create order' }, { status: 500 });
    }
  } catch (error) {
    console.error('[POST /api/orders] error', error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
