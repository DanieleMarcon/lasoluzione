// src/lib/cart.ts
import { prisma } from '@/lib/prisma';

// ---- Tipi locali (indipendenti da Prisma) ----
export type CartItemEntity = {
  id: number;
  cartId: string;
  productId: number;
  nameSnapshot: string;
  priceCentsSnapshot: number;
  qty: number;
  imageUrlSnapshot: string | null;
  meta: unknown | null;
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

// ---- Mapping helpers ----
function mapCartItem(item: {
  id: number;
  cartId: string;
  productId: number;
  nameSnapshot: string;
  priceCentsSnapshot: number;
  qty: number;
  imageUrlSnapshot: string | null;
  meta: unknown | null;
  createdAt: Date;
  updatedAt: Date;
}): CartItemEntity {
  return {
    id: item.id,
    cartId: item.cartId,
    productId: item.productId,
    nameSnapshot: item.nameSnapshot,
    priceCentsSnapshot: item.priceCentsSnapshot,
    qty: item.qty,
    imageUrlSnapshot: item.imageUrlSnapshot ?? null,
    meta: item.meta ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

function mapCartWithItems(cart: {
  id: string;
  status: string;
  totalCents: number;
  createdAt: Date;
  updatedAt: Date;
  items: Array<Parameters<typeof mapCartItem>[0]>;
}): CartWithItems {
  return {
    id: cart.id,
    status: cart.status,
    totalCents: cart.totalCents,
    createdAt: cart.createdAt,
    updatedAt: cart.updatedAt,
    items: cart.items.map(mapCartItem),
  };
}

// ---- Queries ----
async function findCartWithItems(id: string): Promise<CartWithItems | null> {
  const cart = await prisma.cart.findUnique({
    where: { id },
    include: { items: true },
  });
  if (!cart) return null;
  return mapCartWithItems(cart);
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
  return mapCartWithItems(created);
}

export async function recalcCartTotal(cartId: string) {
  const items = await prisma.cartItem.findMany({
    where: { cartId },
    select: { priceCentsSnapshot: true, qty: true },
  });
  const total = items.reduce(
    (acc: number, it: { priceCentsSnapshot: number; qty: number }) =>
      acc + it.priceCentsSnapshot * it.qty,
    0
  );
  await prisma.cart.update({ where: { id: cartId }, data: { totalCents: total } });
  return total;
}

// ---- DTO ----
import type { CartDTO, CartItemDTO } from '@/types/cart';

function toCartItemDTO(item: CartItemEntity): CartItemDTO {
  const dto: CartItemDTO = {
    id: item.id,
    productId: item.productId,
    nameSnapshot: item.nameSnapshot,
    priceCentsSnapshot: item.priceCentsSnapshot,
    qty: item.qty,
  };
  if (item.imageUrlSnapshot) dto.imageUrlSnapshot = item.imageUrlSnapshot;
  if (item.meta != null) dto.meta = item.meta;
  return dto;
}

export function toCartDTO(cart: CartWithItems): CartDTO {
  return {
    id: cart.id,
    token: cart.id, // nel tuo dominio token == id
    status: cart.status as CartDTO['status'],
    totalCents: cart.totalCents,
    items: cart.items.map(toCartItemDTO),
  };
}
