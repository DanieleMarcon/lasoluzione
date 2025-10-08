import 'server-only';

import { Prisma, type Booking, type Order as PrismaOrder } from '@prisma/client';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { recalcCartTotal } from '@/lib/cart';
import { createRevolutOrder, isRevolutPaid, retrieveRevolutOrder } from '@/lib/revolut';
import { encodeRevolutPaymentMeta, parsePaymentRef } from '@/lib/paymentRef';
import {
  sendOrderConfirmation,
  sendOrderFailure,
  sendOrderNotificationToAdmin,
} from '@/lib/mailer';

// Argomenti "validati" per ottenere Order con cart(items) + bookings
const orderWithCartArgs = Prisma.validator<Prisma.OrderDefaultArgs>()({
  include: { cart: { include: { items: true } }, bookings: true },
});

export type OrderWithCart = Prisma.OrderGetPayload<typeof orderWithCartArgs>;
export type CartWithItems = OrderWithCart['cart'];
export type CartItemRow = CartWithItems['items'][number];

const DEFAULT_BOOKING_SETTINGS_ID = 1;

export const OrderInput = z.object({
  cartId: z.string().min(1),
  email: z.string().email(),
  name: z.string().min(1),
  phone: z.string().min(6),
  notes: z.string().max(2000).optional().nullable(),
});

export type CreateOrderSuccess =
  | {
      ok: true;
      data: { orderId: string; status: 'paid' };
    }
  | {
      ok: true;
      data: {
        orderId: string;
        status: 'pending_payment';
        totalCents: number;
        revolutToken: string;
      };
    };

export type CreateOrderResult = CreateOrderSuccess | { ok: false; error: string };

export class OrderWorkflowError extends Error {
  status: number;

  constructor(code: string, status = 400) {
    super(code);
    this.name = 'OrderWorkflowError';
    this.status = status;
  }
}

async function getOrderWithCart(orderId: string): Promise<OrderWithCart> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    ...orderWithCartArgs,
  });

  if (!order || !order.cart) {
    throw new OrderWorkflowError('order_not_found', 404);
  }

  return order;
}

function mapItemsForMail(cart: CartWithItems) {
  return cart.items.map((item: CartItemRow) => ({
    id: item.id,
    productId: item.productId,
    name: item.nameSnapshot,
    qty: item.qty,
    priceCents: item.priceCentsSnapshot,
    totalCents: item.priceCentsSnapshot * item.qty,
  }));
}

function mapCartItems(cart: CartWithItems) {
  return cart.items.map((item: CartItemRow) => ({
    productId: item.productId,
    name: item.nameSnapshot,
    qty: item.qty,
    priceCents: item.priceCentsSnapshot,
  }));
}

type CartItemDto = ReturnType<typeof mapCartItems>[number];

function detectBookingType(order: OrderWithCart): Booking['type'] {
  const hasEventItem = order.cart.items.some((item: CartItemRow) => {
    const meta = item.meta as Record<string, unknown> | null;
    if (meta && typeof meta === 'object') {
      const values = Object.values(meta).map((value) =>
        typeof value === 'string' ? value.toLowerCase() : value
      );
      if (values.some((value) => value === 'eventi' || value === 'event' || value === 'evento')) {
        return true;
      }
    }
    return item.nameSnapshot.toLowerCase().includes('evento');
  });

  return hasEventItem ? 'evento' : 'pranzo';
}

export async function ensureBookingFromOrder(orderId: string) {
  const order = await getOrderWithCart(orderId);
  return ensureBookingInternal(order);
}

export async function findOrderByReference(ref: string) {
  if (!ref) return null;
  return prisma.order.findFirst({
    where: {
      OR: [
        { id: ref },
        { paymentRef: ref },
        { paymentRef: { contains: ref } },
      ],
    },
  });
}

async function ensureBookingInternal(order: OrderWithCart) {
  const [settings] = await Promise.all([
    prisma.bookingSettings.findUnique({ where: { id: DEFAULT_BOOKING_SETTINGS_ID } }),
  ]);

  const bookingDate = settings?.fixedDate ?? new Date();
  const bookingType = detectBookingType(order);
  const items = mapCartItems(order.cart);
  const people = items.reduce(
    (sum: number, item: CartItemDto) => sum + item.qty,
    0
  ) || 1;
  const totalCents = order.totalCents ?? order.cart.totalCents ?? 0;

  const data = {
    date: bookingDate,
    people,
    name: order.name,
    email: order.email,
    phone: order.phone ?? '',
    type: bookingType,
    status: 'confirmed' as const,
    orderId: order.id,
    lunchItemsJson: items,
    subtotalCents: totalCents,
    totalCents,
    ...(order.notes != null ? { notes: order.notes } : {}),
  } satisfies Parameters<typeof prisma.booking.upsert>[0]['create'];

  const currentBooking = order.bookings[0]
    ? await prisma.booking.findUnique({ where: { id: order.bookings[0].id } })
    : null;

  const booking = currentBooking
    ? await prisma.booking.update({ where: { id: currentBooking.id }, data })
    : await prisma.booking.create({ data });

  return { booking, order };
}

export async function createOrderFromCart(rawInput: unknown): Promise<CreateOrderResult> {
  const parsed = OrderInput.safeParse(rawInput);
  if (!parsed.success) {
    return { ok: false, error: 'invalid_payload' };
  }

  const { cartId, email, name, phone, notes } = parsed.data;
  const normalizedNotes = typeof notes === 'string' ? notes.trim() : undefined;

  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: { items: true },
  });

  if (!cart) throw new OrderWorkflowError('cart_not_found', 404);
  if (!Array.isArray(cart.items) || cart.items.length === 0) {
    throw new OrderWorkflowError('cart_empty', 400);
  }
  if (cart.status !== 'open' && cart.status !== 'locked') {
    throw new OrderWorkflowError('cart_not_ready', 400);
  }

  const totalCents = await recalcCartTotal(cartId);
  const status = totalCents > 0 ? 'pending_payment' : 'paid';

  const order = await prisma.order.create({
    data: {
      cartId,
      email,
      name,
      phone,
      status,
      totalCents,
      ...(normalizedNotes ? { notes: normalizedNotes } : {}),
    },
  });

  if (totalCents <= 0) {
    await finalizePaidOrder(order.id);
    return { ok: true, data: { orderId: order.id, status: 'paid' } };
  }

  try {
    const description = `Prenotazione #${order.id} – La Soluzione`;
    const revolutOrder = await createRevolutOrder({
      amountMinor: totalCents,
      currency: 'EUR',
      merchantOrderId: order.id,
      customer: { email, name },
      description,
      captureMode: 'automatic',
    });

    const meta = encodeRevolutPaymentMeta({
      provider: 'revolut',
      orderId: revolutOrder.paymentRef,
      checkoutPublicId: revolutOrder.checkoutPublicId,
      hostedPaymentUrl: revolutOrder.hostedPaymentUrl,
    });

    await prisma.order.update({
      where: { id: order.id },
      data: {
        paymentRef: meta,
        status: 'pending_payment',
      },
    });

    const revolutToken =
      revolutOrder.checkoutPublicId ?? revolutOrder.paymentRef ?? order.id;

    return {
      ok: true,
      data: { orderId: order.id, status: 'pending_payment', totalCents, revolutToken },
    };
  } catch (error) {
    await prisma.order.update({ where: { id: order.id }, data: { status: 'failed' } });
    const message = error instanceof Error ? error.message : 'payment_gateway_error';
    throw new OrderWorkflowError(message, 502);
  }
}

export async function finalizePaidOrder(orderId: string): Promise<PrismaOrder> {
  const order = await getOrderWithCart(orderId);

  await prisma.order.update({
    where: { id: order.id },
    data: { status: 'paid' },
  });

  const itemsForMail = mapItemsForMail(order.cart);

  const { booking } = await ensureBookingInternal(order);

  await prisma.cart.update({
    where: { id: order.cartId },
    data: { status: 'completed', totalCents: 0 },
  });
  await prisma.cartItem.deleteMany({ where: { cartId: order.cartId } });

  await sendOrderConfirmation({ to: order.email, order, items: itemsForMail });
  await sendOrderNotificationToAdmin({ order, items: itemsForMail, booking });

  const updated = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
  return updated;
}

export async function markOrderFailed(orderId: string, reason?: string) {
  const order = await prisma.order.update({
    where: { id: orderId },
    data: { status: 'failed' },
  });

  await sendOrderFailure({ order, reason });
  return order;
}

export async function pollOrderStatus(orderId: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) return { status: 'not_found' as const };

  if (order.status === 'paid') return { status: 'paid' as const };
  if (order.status === 'failed') return { status: 'failed' as const };

  const parsedRef = parsePaymentRef(order.paymentRef);
  if (parsedRef.kind !== 'revolut') {
    return { status: 'pending' as const };
  }

  const revolutOrderId = parsedRef.meta.orderId;
  if (!revolutOrderId) {
    return { status: 'pending' as const };
  }

  const remote = await retrieveRevolutOrder(revolutOrderId);
  if (isRevolutPaid(remote.state)) {
    await finalizePaidOrder(order.id);
    return { status: 'paid' as const };
  }

  if (remote.state === 'failed' || remote.state === 'cancelled' || remote.state === 'declined') {
    await markOrderFailed(order.id, remote.state);
    return { status: 'failed' as const };
  }

  return { status: 'pending' as const };
}
