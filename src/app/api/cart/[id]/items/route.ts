import { NextResponse } from 'next/server';
import { z } from 'zod';

import { getCartByToken, recalcCartTotal, toCartDTO } from '@/lib/cart';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const addItemSchema = z
  .object({
    productId: z.number().int().positive(),
    qty: z.number().int().positive(),
    meta: z.unknown().optional(),
  })
  .strict();

const updateItemSchema = z
  .object({
    itemId: z.number().int().positive(),
    qty: z.number().int(),
  })
  .strict();

async function ensureCartExists(cartId: string) {
  const cart = await prisma.cart.findUnique({ where: { id: cartId } });
  return cart;
}

export async function POST(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = addItemSchema.safeParse(body ?? {});

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
    }

    const cartId = params.id;
    const cart = await ensureCartExists(cartId);

    if (!cart) {
      return NextResponse.json({ ok: false, error: 'Cart not found' }, { status: 404 });
    }

    const { productId, qty, meta } = parsed.data;

    const product = await prisma.product.findUnique({ where: { id: productId } });

    if (!product) {
      return NextResponse.json({ ok: false, error: 'Product not found' }, { status: 404 });
    }

    // TODO: handle stock/availability validation when implementing inventory

    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId,
        productId,
      },
    });

    if (existingItem) {
      await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          qty: existingItem.qty + qty,
          nameSnapshot: product.name,
          priceCentsSnapshot: product.priceCents,
          imageUrlSnapshot: product.imageUrl ?? null,
          meta: meta ?? existingItem.meta ?? null,
        },
      });
    } else {
      await prisma.cartItem.create({
        data: {
          cartId,
          productId,
          qty,
          nameSnapshot: product.name,
          priceCentsSnapshot: product.priceCents,
          imageUrlSnapshot: product.imageUrl ?? null,
          meta: meta ?? null,
        },
      });
    }

    await recalcCartTotal(cartId);

    const updatedCart = await getCartByToken(cartId);

    if (!updatedCart) {
      return NextResponse.json({ ok: false, error: 'Cart not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: toCartDTO(updatedCart) });
  } catch (error) {
    console.error(`[POST /api/cart/${params.id}/items] error`, error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  try {
    const body = await request.json().catch(() => ({}));
    const parsed = updateItemSchema.safeParse(body ?? {});

    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'Invalid payload' }, { status: 400 });
    }

    const cartId = params.id;
    const cart = await ensureCartExists(cartId);

    if (!cart) {
      return NextResponse.json({ ok: false, error: 'Cart not found' }, { status: 404 });
    }

    const { itemId, qty } = parsed.data;

    const item = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cartId,
      },
    });

    if (!item) {
      return NextResponse.json({ ok: false, error: 'Item not found' }, { status: 404 });
    }

    if (qty <= 0) {
      await prisma.cartItem.delete({ where: { id: item.id } });
    } else {
      await prisma.cartItem.update({
        where: { id: item.id },
        data: { qty },
      });
    }

    await recalcCartTotal(cartId);

    const updatedCart = await getCartByToken(cartId);

    if (!updatedCart) {
      return NextResponse.json({ ok: false, error: 'Cart not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: toCartDTO(updatedCart) });
  } catch (error) {
    console.error(`[PATCH /api/cart/${params.id}/items] error`, error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: Request, { params }: { params: { id: string } }) {
  try {
    const url = new URL(request.url);
    const itemIdParam = url.searchParams.get('itemId');

    if (!itemIdParam) {
      return NextResponse.json({ ok: false, error: 'Missing itemId' }, { status: 400 });
    }

    const itemId = Number(itemIdParam);

    if (!Number.isInteger(itemId) || itemId <= 0) {
      return NextResponse.json({ ok: false, error: 'Invalid itemId' }, { status: 400 });
    }

    const cartId = params.id;
    const cart = await ensureCartExists(cartId);

    if (!cart) {
      return NextResponse.json({ ok: false, error: 'Cart not found' }, { status: 404 });
    }

    const item = await prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cartId,
      },
    });

    if (!item) {
      return NextResponse.json({ ok: false, error: 'Item not found' }, { status: 404 });
    }

    await prisma.cartItem.delete({ where: { id: item.id } });

    await recalcCartTotal(cartId);

    const updatedCart = await getCartByToken(cartId);

    if (!updatedCart) {
      return NextResponse.json({ ok: false, error: 'Cart not found' }, { status: 404 });
    }

    return NextResponse.json({ ok: true, data: toCartDTO(updatedCart) });
  } catch (error) {
    console.error(`[DELETE /api/cart/${params.id}/items] error`, error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
