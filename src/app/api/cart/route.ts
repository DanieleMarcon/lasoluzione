import { NextResponse } from 'next/server';
import { z } from 'zod';

import { ensureCart, getCartByToken, toCartDTO } from '@/lib/cart';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const postSchema = z
  .object({
    token: z.string().min(1).optional(),
  })
  .strict();

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = postSchema.safeParse(body ?? {});

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
    }

    const { token } = parsed.data;

    let cart = token ? await getCartByToken(token) : null;

    if (!cart) {
      const ensured = await ensureCart({ token });
      cart = await getCartByToken(ensured.id);
    }

    if (!cart) {
      return NextResponse.json({ ok: false, error: 'Unable to create cart' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, data: toCartDTO(cart) });
  } catch (error) {
    console.error('[POST /api/cart] error', error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return NextResponse.json({ ok: false, error: 'Missing cart token' }, { status: 400 });
    }

    const cart = await getCartByToken(token);

    if (!cart) {
      return NextResponse.json({ ok: false, error: 'Cart not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: toCartDTO(cart) });
  } catch (error) {
    console.error('[GET /api/cart] error', error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
