// src/app/api/cart/[id]/items/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Body per ADD/UPDATE riga carrello
const upsertSchema = z.object({
  productId: z.coerce.number().int().positive(),
  qty: z.coerce.number().int().min(0).optional(), // 0 => rimozione
  nameSnapshot: z.string().trim().min(1).optional(),
  priceCentsSnapshot: z.coerce.number().int().min(0).optional(),
  imageUrlSnapshot: z.string().url().optional(),
  // meta opzionale (se null, per compat ora lo ignoriamo)
  meta: z.union([z.record(z.any()), z.null()]).optional(),
});

type RouteContext = { params: { id: string } };
type SumItem = { priceCentsSnapshot: number; qty: number };

async function recalcTotal(cartId: string) {
  const items: SumItem[] = await prisma.cartItem.findMany({
    where: { cartId },
    select: { priceCentsSnapshot: true, qty: true },
  });
  const total = items.reduce(
    (acc: number, it: SumItem) => acc + it.priceCentsSnapshot * it.qty,
    0
  );
  await prisma.cart.update({ where: { id: cartId }, data: { totalCents: total } });
  return total;
}

/**
 * POST = add/update riga nel carrello
 * Se qty = 0 rimuove la riga.
 */
export async function POST(request: Request, ctx: RouteContext) {
  const cartId = ctx.params.id;

  let payload: z.infer<typeof upsertSchema>;
  try {
    payload = upsertSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'validation_error', details: error.flatten() },
        { status: 400 }
      );
    }
    throw error;
  }

  // Esistenza carrello
  const cart = await prisma.cart.findUnique({ where: { id: cartId } });
  if (!cart) {
    return NextResponse.json({ ok: false, error: 'cart_not_found' }, { status: 404 });
  }

  // qty = 0 -> delete
  if ((payload.qty ?? 1) <= 0) {
    await prisma.cartItem.deleteMany({ where: { cartId, productId: payload.productId } });
    await recalcTotal(cartId);
    return NextResponse.json({ ok: true, data: null });
  }

  const product = await prisma.product.findUnique({
    where: { id: payload.productId },
    select: { priceCents: true, name: true, imageUrl: true },
  });

  if (!product) {
    return NextResponse.json({ ok: false, error: 'product_not_found' }, { status: 404 });
  }

  const snapshotPrice = product.priceCents;
  const rawName = payload.nameSnapshot ?? product.name ?? 'Prodotto';
  const snapshotName =
    typeof rawName === 'string' && rawName.trim().length > 0
      ? rawName.trim()
      : 'Prodotto';
  const snapshotImage = payload.imageUrlSnapshot ?? product.imageUrl ?? null;

  // Trova item esistente
  const existing = await prisma.cartItem.findFirst({
    where: { cartId, productId: payload.productId },
  });

  if (existing) {
    // costruiamo data con any per evitare mismatch del tipo 'meta'
    const data: any = {
      qty: payload.qty ?? existing.qty,
      nameSnapshot: snapshotName,
      priceCentsSnapshot: snapshotPrice,
      imageUrlSnapshot: snapshotImage,
    };
    if (payload.meta !== undefined && payload.meta !== null) {
      data.meta = payload.meta as any;
    }

    const updated = await prisma.cartItem.update({
      where: { id: existing.id },
      data,
    });

    await recalcTotal(cartId);
    return NextResponse.json({ ok: true, data: updated });
  }

  // CREATE item
  const dataCreate: any = {
    cartId,
    productId: payload.productId,
    qty: payload.qty ?? 1,
    nameSnapshot: snapshotName,
    priceCentsSnapshot: snapshotPrice,
    imageUrlSnapshot: snapshotImage,
  };
  if (payload.meta !== undefined && payload.meta !== null) {
    dataCreate.meta = payload.meta as any;
  }

  const created = await prisma.cartItem.create({ data: dataCreate });

  await recalcTotal(cartId);
  return NextResponse.json({ ok: true, data: created }, { status: 201 });
}

/**
 * DELETE = rimuove item dal carrello (via query productId)
 */
export async function DELETE(request: Request, ctx: RouteContext) {
  const cartId = ctx.params.id;
  const productId = Number(new URL(request.url).searchParams.get('productId') ?? '');

  if (!Number.isFinite(productId) || productId <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_product' }, { status: 400 });
  }

  await prisma.cartItem.deleteMany({ where: { cartId, productId } });
  await recalcTotal(cartId);

  return NextResponse.json({ ok: true, data: null });
}
