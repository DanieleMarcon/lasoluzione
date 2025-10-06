// src/app/api/cart/[id]/items/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { assertAdmin } from '@/lib/admin/session'; // se questa rotta è pubblica rimuovi questa import/guard

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Body per ADD/UPDATE item nel carrello
const upsertSchema = z.object({
  productId: z.coerce.number().int().positive(),
  qty: z.coerce.number().int().min(0).optional(), // 0 => rimozione
  nameSnapshot: z.string().trim().min(1).optional(),
  priceCentsSnapshot: z.coerce.number().int().min(0).optional(),
  imageUrlSnapshot: z.string().url().optional(),
  // meta può essere: assente (non toccare), oggetto (JSON valido), oppure null (svuota il campo)
  meta: z.union([z.record(z.any()), z.null()]).optional(),
});

type RouteContext = { params: { id: string } };

/**
 * POST = add/update riga nel carrello
 * Se qty = 0 rimuove la riga.
 */
export async function POST(request: Request, ctx: RouteContext) {
  // se pubblica, commenta: await assertAdmin();
  const cartId = ctx.params.id;

  let payload: z.infer<typeof upsertSchema>;
  try {
    payload = upsertSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: 'validation_error', details: error.flatten() }, { status: 400 });
    }
    throw error;
  }

  // Esistenza carrello
  const cart = await prisma.cart.findUnique({ where: { id: cartId } });
  if (!cart) {
    return NextResponse.json({ ok: false, error: 'cart_not_found' }, { status: 404 });
  }

  // Se qty = 0 => delete
  if (payload.qty !== undefined && payload.qty <= 0) {
    await prisma.cartItem.deleteMany({
      where: { cartId, productId: payload.productId },
    });

    // ricalcolo totale
    const items = await prisma.cartItem.findMany({ where: { cartId } });
    const nextTotal = items.reduce((acc, it) => acc + it.priceCentsSnapshot * it.qty, 0);
    await prisma.cart.update({ where: { id: cartId }, data: { totalCents: nextTotal } });

    return NextResponse.json({ ok: true, data: null });
  }

  // Trova item esistente
  const existingItem = await prisma.cartItem.findFirst({
    where: { cartId, productId: payload.productId },
  });

  // Normalizza meta per Prisma (JsonNull quando vogliamo esplicitamente nullo)
  const normalizedMetaUpdate =
    payload.meta === undefined
      ? undefined
      : payload.meta === null
      ? Prisma.JsonNull
      : (payload.meta as Prisma.InputJsonValue);

  const normalizedMetaCreate =
    payload.meta === null ? Prisma.JsonNull : (payload.meta as Prisma.InputJsonValue | undefined);

  if (existingItem) {
    // UPDATE item
    const nextQty = payload.qty ?? existingItem.qty;

    const updated = await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: {
        qty: nextQty,
        nameSnapshot: payload.nameSnapshot ?? existingItem.nameSnapshot,
        priceCentsSnapshot: payload.priceCentsSnapshot ?? existingItem.priceCentsSnapshot,
        imageUrlSnapshot: payload.imageUrlSnapshot ?? existingItem.imageUrlSnapshot,
        // ⬇⬇ FIX: non usare `null` grezzo, ma Prisma.JsonNull, e lascia undefined per "non toccare"
        meta: normalizedMetaUpdate,
      },
    });

    // ricalcolo totale
    const items = await prisma.cartItem.findMany({ where: { cartId } });
    const nextTotal = items.reduce((acc, it) => acc + it.priceCentsSnapshot * it.qty, 0);
    await prisma.cart.update({ where: { id: cartId }, data: { totalCents: nextTotal } });

    return NextResponse.json({ ok: true, data: updated });
  }

  // CREATE item
  const created = await prisma.cartItem.create({
    data: {
      cartId,
      productId: payload.productId,
      qty: payload.qty ?? 1,
      nameSnapshot: payload.nameSnapshot ?? 'Prodotto',
      priceCentsSnapshot: payload.priceCentsSnapshot ?? 0,
      imageUrlSnapshot: payload.imageUrlSnapshot,
      // ⬇⬇ FIX: su create, traduci null → Prisma.JsonNull
      meta: normalizedMetaCreate,
    },
  });

  // ricalcolo totale
  const items = await prisma.cartItem.findMany({ where: { cartId } });
  const nextTotal = items.reduce((acc, it) => acc + it.priceCentsSnapshot * it.qty, 0);
  await prisma.cart.update({ where: { id: cartId }, data: { totalCents: nextTotal } });

  return NextResponse.json({ ok: true, data: created }, { status: 201 });
}

/**
 * DELETE = rimuove item dal carrello (via query productId)
 */
export async function DELETE(request: Request, ctx: RouteContext) {
  // se pubblica, commenta: await assertAdmin();
  const cartId = ctx.params.id;
  const { searchParams } = new URL(request.url);
  const productId = Number.parseInt(searchParams.get('productId') ?? '', 10);

  if (!Number.isFinite(productId) || productId <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_product' }, { status: 400 });
  }

  await prisma.cartItem.deleteMany({ where: { cartId, productId } });

  const items = await prisma.cartItem.findMany({ where: { cartId } });
  const nextTotal = items.reduce((acc, it) => acc + it.priceCentsSnapshot * it.qty, 0);
  await prisma.cart.update({ where: { id: cartId }, data: { totalCents: nextTotal } });

  return NextResponse.json({ ok: true, data: null });
}
