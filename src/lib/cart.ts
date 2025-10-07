// src/lib/cart.ts
import { prisma } from '@/lib/prisma';

export type CartItemEntity = {
  id: number;
  cartId: string;
  productId: number;
  nameSnapshot: string;
  priceCentsSnapshot: number;
  qty: number;
  imageUrlSnapshot: string | null;
  meta: unknown;
  createdAt: Date;
  updatedAt: Date;
};

export type CartWithItems = {
  id: string;
  status: string;
  totalCents: number;
  createdAt: Date;
  updatedAt: Date;
  items: CartItemEntity[];
};

function mapCartWithItems(cart: {
  id: string;
  status: string;
  totalCents: number;
  createdAt: Date;
  updatedAt: Date;
  items: Array<{
    id: number;
    cartId: string;
    productId: number;
    nameSnapshot: string;
    priceCentsSnapshot: number;
    qty: number;
    imageUrlSnapshot: string | null;
    meta: unknown;
    createdAt: Date;
    updatedAt: Date;
  }>;
}): CartWithItems {
  return {
    id: cart.id,
    status: cart.status,
    totalCents: cart.totalCents,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
    items: cart.items.map((item) => ({
      id: item.id,
      cartId: item.cartId,
      productId: item.productId,
      nameSnapshot: item.nameSnapshot,
      priceCentsSnapshot: item.priceCentsSnapshot,
      qty: item.qty,
      imageUrlSnapshot: item.imageUrlSnapshot,
      meta: item.meta,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    })),
  };
}

async function findCartWithItems(id: string): Promise<CartWithItems | null> {
  const cart = await prisma.cart.findUnique({
    where: { id },
    include: { items: true },
  });

  if (!cart) return null;

  return mapCartWithItems({
    ...cart,
    items: cart.items.map((item) => ({
      ...item,
      imageUrlSnapshot: item.imageUrlSnapshot ?? null,
      meta: item.meta as unknown,
    })),
  });
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

  return mapCartWithItems({
    ...created,
    items: created.items.map((item) => ({
      ...item,
      imageUrlSnapshot: item.imageUrlSnapshot ?? null,
      meta: item.meta as unknown,
    })),
  });
}

export async function recalcCartTotal(cartId: string) {
  const items = await prisma.cartItem.findMany({
    where: { cartId },
    select: { priceCentsSnapshot: true, qty: true },
  });
  const total = items.reduce<number>(
    (acc, item) => acc + item.priceCentsSnapshot * item.qty,
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
    items: cart.items.map((it: CartItemEntity) => {
      const metaValue = it.meta;
      return {
        id: it.id,
        productId: it.productId,
        nameSnapshot: it.nameSnapshot,
        priceCentsSnapshot: it.priceCentsSnapshot,
        qty: it.qty,
        imageUrlSnapshot: it.imageUrlSnapshot ?? undefined,
        ...(metaValue == null ? {} : { meta: metaValue }),
      };
    }),
  };
}
