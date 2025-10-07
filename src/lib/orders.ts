// src/lib/orders.ts
import { prisma } from './prisma';
import { type CartWithItems, getCartByToken, recalcCartTotal } from '@/lib/cart';

import type { CheckoutInput, OrderDTO } from '@/types/order';

// Tipo Order basato sul return di prisma.order.create
type OrderEntity = Awaited<ReturnType<typeof prisma.order.create>>;

export type ValidateCartResult = {
  ok: boolean;
  reason?: string;
};

export function validateCartReady(cart: CartWithItems | null): ValidateCartResult {
  if (!cart) return { ok: false, reason: 'CART_NOT_FOUND' };

  if (cart.status === 'expired') return { ok: false, reason: 'CART_EXPIRED' };

  if (cart.status !== 'open' && cart.status !== 'locked') {
    return { ok: false, reason: 'CART_NOT_READY' };
  }

  if (!Array.isArray(cart.items) || cart.items.length === 0) {
    return { ok: false, reason: 'CART_EMPTY' };
  }

  return { ok: true };
}

export class OrderCheckoutError extends Error {
  status: number;

  constructor(code: string, status = 400) {
    super(code);
    this.name = 'OrderCheckoutError';
    this.status = status;
  }
}

export async function createOrderFromCart(input: CheckoutInput): Promise<OrderEntity> {
  const { token, email, name, phone } = input;

  if (!token) {
    throw new OrderCheckoutError('MISSING_CART_TOKEN');
  }

  const cart = await getCartByToken(token);

  const validation = validateCartReady(cart);
  if (!validation.ok) {
    throw new OrderCheckoutError(validation.reason ?? 'CART_NOT_READY');
  }

  const ensuredCart = cart!;

  const totalCents = await recalcCartTotal(ensuredCart.id);
  const status = totalCents === 0 ? 'confirmed' : 'pending';
  const paymentRef = totalCents === 0 ? 'FREE' : null;

  const order = await prisma.order.create({
    data: {
      cartId: ensuredCart.id,
      email,
      name,
      phone: phone ?? null,
      status,
      totalCents,
      ...(paymentRef ? { paymentRef } : {}),
    },
  });

  return order;
}

export function toOrderDTO(order: OrderEntity): OrderDTO {
  return {
    id: order.id,
    cartId: order.cartId,
    status: order.status,
    totalCents: order.totalCents,
    discountCents: order.discountCents ?? undefined,
    paymentRef: order.paymentRef ?? undefined,
    createdAt: order.createdAt.toISOString(),
  };
}
