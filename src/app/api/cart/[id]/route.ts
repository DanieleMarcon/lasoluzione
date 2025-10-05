import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCartByToken, toCartDTO } from '@/lib/cart';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateCartSchema = z
  .object({
    status: z.enum(['open', 'locked', 'expired']).optional(),
  })
  .strict();

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  try {
    const cart = await getCartByToken(params.id);

    if (!cart) {
      return NextResponse.json({ ok: false, error: 'Cart not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: toCartDTO(cart) });
  } catch (error) {
    console.error(`[GET /api/cart/${params.id}] error`, error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = updateCartSchema.safeParse(body ?? {});

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
    }

    const { status } = parsed.data;

    if (!status) {
      return NextResponse.json({ ok: false, error: 'Nothing to update' }, { status: 400 });
    }

    const cart = await prisma.cart.update({
      where: { id: params.id },
      data: { status },
    });

    const cartWithItems = await getCartByToken(cart.id);

    if (!cartWithItems) {
      return NextResponse.json({ ok: false, error: 'Cart not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: toCartDTO(cartWithItems) });
  } catch (error) {
    console.error(`[PATCH /api/cart/${params.id}] error`, error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
