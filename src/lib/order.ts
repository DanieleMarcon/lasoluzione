import { prisma } from '@/lib/prisma';
import { sendCustomerOrderEmail, sendAdminOrderEmail } from '@/lib/mailer';
import type { Cart, CartItem } from '@prisma/client';

export type FinalizeResult = { ok: true; orderId: string } | { ok: false; error: string };

export async function getOrderByRef(ref: string) {
  if (!ref) return null;

  return prisma.order.findFirst({
    where: {
      OR: [
        { providerRef: ref },
        { paymentRef: ref },
        { paymentRef: { contains: ref } },
      ],
    },
    include: {
      cart: {
        include: {
          items: true,
        },
      },
    },
  });
}

export async function markOrderPaid(ref: string) {
  const order = await prisma.order.findFirst({
    where: {
      OR: [
        { providerRef: ref },
        { paymentRef: ref },
        { paymentRef: { contains: ref } },
      ],
    },
  });

  if (!order) return null;

  return prisma.order.update({
    where: { id: order.id },
    data: { status: 'paid', providerRef: ref },
  });
}

export function calcCartTotals(cart: Cart & { items: CartItem[] }) {
  const subtotal = cart.items.reduce((acc, it) => acc + it.priceCentsSnapshot * it.qty, 0);
  return { subtotalCents: subtotal, totalCents: subtotal };
}

/** Idempotente: se già finalizzato ritorna ok senza duplicare. */
export async function finalizePaidOrder(ref: string): Promise<FinalizeResult> {
  const order = await getOrderByRef(ref);
  if (!order) return { ok: false, error: 'order_not_found' };
  if (order.status !== 'paid') return { ok: false, error: 'order_not_paid' };

  const existing = await prisma.booking.findFirst({ where: { orderId: order.id } });
  if (existing) return { ok: true, orderId: order.id };

  if (!order.cart) {
    return { ok: false, error: 'cart_not_found' };
  }

  const { subtotalCents, totalCents } = calcCartTotals(order.cart as Cart & { items: CartItem[] });
  const lunchItems = order.cart.items.map((i) => ({
    productId: i.productId,
    name: i.nameSnapshot,
    qty: i.qty,
    priceCents: i.priceCentsSnapshot,
  }));

  const booking = await prisma.booking.create({
    data: {
      date: new Date(),
      people: 1,
      name: order.name ?? '',
      email: order.email ?? '',
      phone: order.phone ?? '',
      notes: order.notes ?? null,
      type: 'evento',
      status: 'confirmed',
      orderId: order.id,
      lunchItemsJson: lunchItems,
      coverCents: 0,
      subtotalCents,
      totalCents,
    },
  });

  await prisma.cartItem.deleteMany({ where: { cartId: order.cartId } });
  await prisma.cart.update({ where: { id: order.cartId }, data: { totalCents: 0 } });

  try {
    await sendCustomerOrderEmail({ order, booking });
  } catch (error) {
    console.error('[order][finalize] customer email error', error);
  }

  try {
    await sendAdminOrderEmail({ order, booking });
  } catch (error) {
    console.error('[order][finalize] admin email error', error);
  }

  return { ok: true, orderId: order.id };
}
