// src/app/api/cart/[id]/items/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
// import { assertAdmin } from '@/lib/admin/session'; // se la rotta è pubblica, lascialo commentato

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const upsertSchema = z.object({
  productId: z.coerce.number().int().positive(),
  qty: z.coerce.number().int().min(0).optional(), // 0 => rimozione
  nameSnapshot: z.string().trim().min(1).optional(),
  priceCentsSnapshot: z.coerce.number().int().min(0).optional(),
  imageUrlSnapshot: z.string().url().optional(),
  // meta: assente (non toccare), oggetto JSON, oppure null (svuota il campo)
  meta: z.union([z.record(z.any()), z.null()]).optional(),
});

type RouteContext = { params: { id: string } };

function resolveMetaValue(
  meta: z.infer<typeof upsertSchema>['meta']
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue | undefined {
  if (meta === undefined) {
    return undefined;
  }

  if (meta === null) {
    return Prisma.NullableJsonNullValueInput.DbNull;
  }

  return meta as Prisma.InputJsonValue;
}

/**
 * POST = add/update riga nel carrello
 * Se qty = 0 rimuove la riga.
 */
export async function POST(request: Request, ctx: RouteContext) {
  // await assertAdmin();
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

  // Se qty = 0 => delete
  if (payload.qty !== undefined && payload.qty <= 0) {
    await prisma.cartItem.deleteMany({
      where: { cartId, productId: payload.productId },
    });

    // ricalcolo totale
    const items = await prisma.cartItem.findMany({
      where: { cartId },
      select: { priceCentsSnapshot: true, qty: true },
    });
    const nextTotal = items.reduce<number>(
      (acc, item) => acc + item.priceCentsSnapshot * item.qty,
      0
    );
    await prisma.cart.update({ where: { id: cartId }, data: { totalCents: nextTotal } });

    return NextResponse.json({ ok: true, data: null });
  }

  // Trova item esistente
  const existingItem = await prisma.cartItem.findFirst({
    where: { cartId, productId: payload.productId },
  });

  if (existingItem) {
    // UPDATE item
    const nextQty = payload.qty ?? existingItem.qty;

    const metaValue = resolveMetaValue(payload.meta);

    const updated = await prisma.cartItem.update({
      where: { id: existingItem.id },
      data: {
        qty: nextQty,
        nameSnapshot: payload.nameSnapshot ?? existingItem.nameSnapshot,
        priceCentsSnapshot:
          payload.priceCentsSnapshot ?? existingItem.priceCentsSnapshot,
        imageUrlSnapshot:
          payload.imageUrlSnapshot ?? existingItem.imageUrlSnapshot,
        // Se meta è presente nel payload: lo applichiamo (può essere oggetto o null per svuotare)
        ...(metaValue !== undefined ? { meta: metaValue } : {}),
      },
    });

    // ricalcolo totale
    const items = await prisma.cartItem.findMany({
      where: { cartId },
      select: { priceCentsSnapshot: true, qty: true },
    });
    const nextTotal = items.reduce<number>(
      (acc, item) => acc + item.priceCentsSnapshot * item.qty,
      0
    );
    await prisma.cart.update({ where: { id: cartId }, data: { totalCents: nextTotal } });

    return NextResponse.json({ ok: true, data: updated });
  }

  // CREATE item
  const metaValue = resolveMetaValue(payload.meta);

  const created = await prisma.cartItem.create({
    data: {
      cartId,
      productId: payload.productId,
      qty: payload.qty ?? 1,
      nameSnapshot: payload.nameSnapshot ?? 'Prodotto',
      priceCentsSnapshot: payload.priceCentsSnapshot ?? 0,
      imageUrlSnapshot: payload.imageUrlSnapshot,
      // Se meta è presente: lo settiamo; altrimenti non inviamo il campo
      ...(metaValue !== undefined ? { meta: metaValue } : {}),
    },
  });

  // ricalcolo totale
  const items = await prisma.cartItem.findMany({
    where: { cartId },
    select: { priceCentsSnapshot: true, qty: true },
  });
  const nextTotal = items.reduce<number>(
    (acc, item) => acc + item.priceCentsSnapshot * item.qty,
    0
  );
  await prisma.cart.update({ where: { id: cartId }, data: { totalCents: nextTotal } });

  return NextResponse.json({ ok: true, data: created }, { status: 201 });
}

/**
 * DELETE = rimuove item dal carrello (via query productId)
 */
export async function DELETE(request: Request, ctx: RouteContext) {
  // await assertAdmin();
  const cartId = ctx.params.id;
  const { searchParams } = new URL(request.url);
  const productId = Number.parseInt(searchParams.get('productId') ?? '', 10);

  if (!Number.isFinite(productId) || productId <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_product' }, { status: 400 });
  }

  await prisma.cartItem.deleteMany({ where: { cartId, productId } });

  const items = await prisma.cartItem.findMany({
    where: { cartId },
    select: { priceCentsSnapshot: true, qty: true },
  });
  const nextTotal = items.reduce<number>(
    (acc, item) => acc + item.priceCentsSnapshot * item.qty,
    0
  );
  await prisma.cart.update({ where: { id: cartId }, data: { totalCents: nextTotal } });

  return NextResponse.json({ ok: true, data: null });
}
