// src/lib/cart.ts
import { prisma } from '@/lib/prisma';

// funzione dummy per avere i tipi reali (non viene mai eseguita)
function _cartWithItemsType() {
  return prisma.cart.findUnique({
    where: { id: '' as string },
    include: { items: true },
  });
}
export type CartWithItems = NonNullable<
  Awaited<ReturnType<typeof _cartWithItemsType>>
>;
type CartItemEntity = CartWithItems['items'][number];

async function findCartWithItems(id: string): Promise<CartWithItems | null> {
  return prisma.cart.findUnique({
    where: { id },
    include: { items: true },
  }) as Promise<CartWithItems | null>;
}

export async function getCartById(id: string): Promise<CartWithItems | null> {
  return findCartWithItems(id);
}

export async function getCartByToken(token: string): Promise<CartWithItems | null> {
  return findCartWithItems(token);
}

export async function ensureCart(token?: string | null): Promise<CartWithItems> {
  if (token) {
    const existing = await findCartWithItems(token);
    if (existing) return existing;
  }

  const created = await prisma.cart.create({
    data: { status: 'open', totalCents: 0 },
    include: { items: true },
  });

  return created as CartWithItems;
}

export async function recalcCartTotal(cartId: string) {
  type PQ = { priceCentsSnapshot: number; qty: number };
  const items = await prisma.cartItem.findMany({
    where: { cartId },
    select: { priceCentsSnapshot: true, qty: true },
  });
  const total = items.reduce(
    (acc: number, it: PQ) => acc + it.priceCentsSnapshot * it.qty,
    0
  );
  await prisma.cart.update({ where: { id: cartId }, data: { totalCents: total } });
  return total;
}

import type { CartDTO } from '@/types/cart';

export function toCartDTO(cart: CartWithItems): CartDTO {
  return {
    id: cart.id,
    token: cart.id, // nel tuo dominio token == id
    status: cart.status as CartDTO['status'],
    totalCents: cart.totalCents,
    items: cart.items.map((it: CartItemEntity) => ({
      id: it.id,
      productId: it.productId,
      nameSnapshot: it.nameSnapshot,
      priceCentsSnapshot: it.priceCentsSnapshot,
      qty: it.qty,
      imageUrlSnapshot: it.imageUrlSnapshot ?? undefined,
      meta: (it.meta as unknown) ?? undefined,
    })),
  };
}
