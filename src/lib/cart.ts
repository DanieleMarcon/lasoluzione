import type { Cart, CartItem } from '@prisma/client';

import { prisma } from './prisma';

import type { CartDTO, CartItemDTO } from '@/types/cart';

type CartWithItems = Cart & { items: CartItem[] };

type EnsureCartParams = {
  token?: string | null;
};

export async function ensureCart({ token }: EnsureCartParams = {}): Promise<Cart> {
  if (token) {
    const existing = await prisma.cart.findUnique({ where: { id: token } });
    if (existing) return existing;
  }

  const cart = await prisma.cart.create({
    data: {
      status: 'open',
      totalCents: 0,
    },
  });

  return cart;
}

export async function getCartByToken(token: string): Promise<CartWithItems | null> {
  if (!token) return null;

  const cart = await prisma.cart.findUnique({
    where: { id: token },
    include: { items: true },
  });

  return cart;
}

export async function recalcCartTotal(cartId: string): Promise<number> {
  const items = await prisma.cartItem.findMany({
    where: { cartId },
  });

  const total = items.reduce((sum, item) => sum + item.qty * item.priceCentsSnapshot, 0);

  await prisma.cart.update({
    where: { id: cartId },
    data: { totalCents: total },
  });

  return total;
}

export function toCartDTO(cart: CartWithItems): CartDTO {
  return {
    id: cart.id,
    token: cart.id,
    status: cart.status as CartDTO['status'],
    totalCents: cart.totalCents,
    items: cart.items.map((item): CartItemDTO => ({
      id: item.id,
      productId: item.productId,
      nameSnapshot: item.nameSnapshot,
      priceCentsSnapshot: item.priceCentsSnapshot,
      qty: item.qty,
      imageUrlSnapshot: item.imageUrlSnapshot ?? undefined,
      meta: item.meta ?? undefined,
    })),
  };
}
