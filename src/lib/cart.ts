// src/lib/cart.ts
import type { Cart, CartItem } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export type CartWithItems = Cart & { items: CartItem[] };

async function findCartWithItems(id: string): Promise<CartWithItems | null> {
  const cart = await prisma.cart.findUnique({ where: { id } });
  if (!cart) return null;
  const items = await prisma.cartItem.findMany({ where: { cartId: id } });
  return { ...cart, items } satisfies CartWithItems;
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
  });

  return { ...created, items: [] } satisfies CartWithItems;
}

export async function recalcCartTotal(cartId: string) {
  const items = await prisma.cartItem.findMany({ where: { cartId } });
  const total = items.reduce((acc, it) => acc + it.priceCentsSnapshot * it.qty, 0);
  await prisma.cart.update({ where: { id: cartId }, data: { totalCents: total } });
  return total;
}

import type { CartDTO } from '@/types/cart';

export function toCartDTO(cart: CartWithItems): CartDTO {
  return {
    id: cart.id,
    token: cart.id,
    status: cart.status as CartDTO['status'],
    totalCents: cart.totalCents,
    items: cart.items.map((it) => ({
      id: it.id,
      productId: it.productId,
      nameSnapshot: it.nameSnapshot,
      priceCentsSnapshot: it.priceCentsSnapshot,
      qty: it.qty,
      imageUrlSnapshot: it.imageUrlSnapshot ?? undefined,
      meta: (it.meta as any) ?? undefined,
    })),
  };
}