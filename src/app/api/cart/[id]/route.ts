// src/app/api/cart/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCartById, toCartDTO } from '@/lib/cart';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Ctx = { params: { id: string } };

/**
 * GET /api/cart/:id
 * Restituisce il carrello (DTO).
 */
export async function GET(_req: Request, { params }: Ctx) {
  const cart = await getCartById(params.id);
  if (!cart) {
    return NextResponse.json({ ok: false, error: 'cart_not_found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, data: toCartDTO(cart) });
}

/**
 * PATCH /api/cart/:id
 * Ricalcola il totale a partire dalle righe del carrello e restituisce il DTO aggiornato.
 */
export async function PATCH(_req: Request, { params }: Ctx) {
  const cartId = params.id;

  const rows = await prisma.cartItem.findMany({
    where: { cartId },
    select: { priceCentsSnapshot: true, qty: true },
  });

  // TIPI ESPLICITI su accumulator/row per evitare "implicitly has 'any' type"
  const total = rows.reduce(
    (a: number, r: { priceCentsSnapshot: number; qty: number }) =>
      a + r.priceCentsSnapshot * r.qty,
    0
  );

  await prisma.cart.update({ where: { id: cartId }, data: { totalCents: total } });

  const cart = await getCartById(cartId);
  if (!cart) {
    return NextResponse.json({ ok: false, error: 'cart_not_found' }, { status: 404 });
  }
  return NextResponse.json({ ok: true, data: toCartDTO(cart) });
}
