import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { consumeBookingToken } from '@/lib/bookingVerification';
import { sendOrderConfirmation, sendOrderNotificationToAdmin } from '@/lib/mailer';
import { logger } from '@/lib/logger';
import { formatEventSchedule } from '@/lib/date';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mapErrorStatus(): number {
  return 400;
}

function extractEventInstanceId(booking: unknown): number | null {
  if (!booking || typeof booking !== 'object') {
    return null;
  }
  const maybeId = (booking as { eventInstanceId?: unknown }).eventInstanceId;
  if (typeof maybeId === 'number' && Number.isFinite(maybeId) && maybeId > 0) {
    return maybeId;
  }
  return null;
}

function fallbackWhenLabel(date: Date): string {
  try {
    return date.toLocaleString('it-IT', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';

  const result = await consumeBookingToken(token);

  if (result.status !== 'ok') {
    logger.warn('booking.confirm', {
      action: 'booking.confirm',
      outcome: result.status,
    });
    return NextResponse.json({ ok: false, state: result.status }, { status: mapErrorStatus() });
  }

  const booking = result.booking;

  const updated =
    booking.status === 'confirmed'
      ? booking
      : await prisma.booking.update({
          where: { id: booking.id },
          data: { status: 'confirmed', prepayToken: null },
        });

  type OrderMailParams = Parameters<typeof sendOrderConfirmation>[0];
  type MailOrder = OrderMailParams['order'];
  type MailItem = OrderMailParams['items'][number];

  let mailOrder: MailOrder | null = null;
  let mailItems: MailItem[] = [];

  if (updated.orderId) {
    const orderWithCart = await prisma.order.findUnique({
      where: { id: updated.orderId },
      include: { cart: { include: { items: true } } },
    });

    if (orderWithCart) {
      mailItems = orderWithCart.cart.items.map((item) => ({
        name: item.nameSnapshot,
        qty: item.qty,
        priceCents: item.priceCentsSnapshot,
      }));

      if (orderWithCart.status !== 'confirmed') {
        try {
          await prisma.order.update({
            where: { id: orderWithCart.id },
            data: { status: 'confirmed' },
          });
        } catch (error) {
          logger.error('booking.confirm', {
            action: 'booking.confirm',
            outcome: 'order_status_update_error',
            bookingId: updated.id,
            orderId: orderWithCart.id,
            error: error instanceof Error ? error.message : 'unknown_error',
          });
        }
      }

      if (orderWithCart.status === 'pending') {
        try {
          await prisma.cart.update({
            where: { id: orderWithCart.cartId },
            data: { status: 'completed', totalCents: 0 },
          });
          await prisma.cartItem.deleteMany({ where: { cartId: orderWithCart.cartId } });
        } catch (error) {
          logger.error('booking.confirm', {
            action: 'booking.confirm',
            outcome: 'order_cart_cleanup_error',
            bookingId: updated.id,
            orderId: orderWithCart.id,
            error: error instanceof Error ? error.message : 'unknown_error',
          });
        }
      }

      mailOrder = {
        id: orderWithCart.id,
        name: orderWithCart.name,
        email: orderWithCart.email,
        phone: orderWithCart.phone,
        notes: orderWithCart.notes ?? undefined,
        totalCents: orderWithCart.totalCents ?? orderWithCart.cart.totalCents ?? 0,
      };
    }
  }

  const eventInstanceId = extractEventInstanceId(updated);
  let eventInstance: { title: string | null; startAt: Date; endAt: Date | null } | null = null;

  if (eventInstanceId) {
    eventInstance = await prisma.eventInstance.findUnique({
      where: { id: eventInstanceId },
      select: { title: true, startAt: true, endAt: true },
    });
  } else if (updated.tierLabel) {
    eventInstance = await prisma.eventInstance.findFirst({
      where: { title: updated.tierLabel, startAt: updated.date },
      select: { title: true, startAt: true, endAt: true },
    });
  }

  const eventTitle = eventInstance?.title ?? updated.tierLabel ?? 'La Soluzione';
  const whenLabelRaw = formatEventSchedule(
    eventInstance?.startAt ?? updated.date,
    eventInstance?.endAt ?? undefined,
  );
  const whenLabel = whenLabelRaw.trim().length ? whenLabelRaw : fallbackWhenLabel(eventInstance?.startAt ?? updated.date);
  if (!mailOrder) {
    const pricePerPerson = typeof updated.tierPriceCents === 'number' ? updated.tierPriceCents : 0;
    const nameParts = [eventTitle];
    if (whenLabel) {
      nameParts.push(whenLabel);
    }

    mailOrder = {
      id: `booking-${updated.id}`,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      notes: updated.notes ?? undefined,
      totalCents: pricePerPerson * updated.people,
    };

    mailItems = [
      {
        name: nameParts.filter(Boolean).join(' – ') || eventTitle,
        qty: updated.people,
        priceCents: pricePerPerson,
      },
    ];
  }

  try {
    await sendOrderConfirmation({ to: mailOrder.email, order: mailOrder, items: mailItems });
  } catch (error) {
    logger.error('booking.confirm', {
      action: 'booking.confirm',
      outcome: 'order_customer_email_error',
      bookingId: updated.id,
      orderId: mailOrder.id,
      error: error instanceof Error ? error.message : 'unknown_error',
    });
  }

  try {
    await sendOrderNotificationToAdmin({
      order: mailOrder,
      items: mailItems,
      booking: { date: updated.date, people: updated.people },
    });
  } catch (error) {
    logger.error('booking.confirm', {
      action: 'booking.confirm',
      outcome: 'order_admin_email_error',
      bookingId: updated.id,
      orderId: mailOrder.id,
      error: error instanceof Error ? error.message : 'unknown_error',
    });
  }

  logger.info(
    JSON.stringify({
      action: 'booking.confirm.emails_sent',
      bookingId: updated.id,
      email: updated.email,
    }),
  );

  logger.info('booking.confirm', {
    action: 'booking.confirm',
    outcome: 'ok',
    bookingId: updated.id,
    email: updated.email,
  });

  return NextResponse.json({ ok: true, state: 'confirmed' as const });
}
