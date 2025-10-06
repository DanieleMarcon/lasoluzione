// src/lib/cart.ts
import type { Prisma as PrismaTypes } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export async function getCartById(id: string) {
  const found = await prisma.cart.findUnique(
    {
      where: { id },
      include: { items: true },
    } satisfies PrismaTypes.CartFindUniqueArgs
  );
  return found;
}

// Nella nostra implementazione il "token" coincide con l'id del carrello
export async function getCartByToken(token: string) {
  return getCartById(token);
}

// Se esiste il token -> restituisci; altrimenti crea un carrello nuovo
export async function ensureCart(token?: string) {
  if (token) {
    const existing = await getCartById(token);
    if (existing) return existing;
  }
  const created = await prisma.cart.create(
    {
      data: { status: 'open', totalCents: 0 },
      include: { items: true },
    } satisfies PrismaTypes.CartCreateArgs
  );
  return created;
}

export async function recalcCartTotal(cartId: string) {
  const items = await prisma.cartItem.findMany({
    where: { cartId },
  });
  const total = items.reduce((acc, it) => acc + it.priceCentsSnapshot * it.qty, 0);
  await prisma.cart.update({ where: { id: cartId }, data: { totalCents: total } });
  return total;
}

// ---- DTO helper ----
import type { Cart, CartItem } from '@prisma/client';
import type { CartDTO } from '@/types/cart';

export function toCartDTO(cart: Cart & { items: CartItem[] }): CartDTO {
  return {
    id: cart.id,
    status: cart.status,
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
