import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { consumeBookingToken } from '@/lib/bookingVerification';
import { sendBookingConfirmedAdmin, sendBookingConfirmedCustomer } from '@/lib/mailer';
import { logger } from '@/lib/logger';
import { formatEventSchedule } from '@/lib/date';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mapErrorStatus(status: 'invalid' | 'expired' | 'used'): number {
  if (status === 'expired') return 410;
  if (status === 'used') return 409;
  return 400;
}

function resolveBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.APP_BASE_URL ?? '';
  return raw.replace(/\/$/, '');
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
    return NextResponse.json(
      { ok: false, state: result.status },
      { status: mapErrorStatus(result.status) },
    );
  }

  const booking = result.booking;

  const updated =
    booking.status === 'confirmed'
      ? booking
      : await prisma.booking.update({
          where: { id: booking.id },
          data: { status: 'confirmed', prepayToken: null },
        });

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
  const baseUrl = resolveBaseUrl();

  try {
    await sendBookingConfirmedCustomer({
      to: updated.email,
      bookingId: updated.id,
      eventTitle,
      whenLabel,
      people: updated.people,
      baseUrl,
    });
  } catch (error) {
    logger.error('booking.confirm', {
      action: 'booking.confirm',
      outcome: 'customer_email_error',
      bookingId: updated.id,
      email: updated.email,
      error: error instanceof Error ? error.message : 'unknown_error',
    });
  }

  const adminRecipient = process.env.MAIL_TO_BOOKINGS?.trim();
  if (adminRecipient) {
    try {
      await sendBookingConfirmedAdmin({
        to: adminRecipient,
        bookingId: updated.id,
        customerName: updated.name,
        customerEmail: updated.email,
        customerPhone: updated.phone,
        eventTitle,
        whenLabel,
        people: updated.people,
      });
    } catch (error) {
      logger.error('booking.confirm', {
        action: 'booking.confirm',
        outcome: 'admin_email_error',
        bookingId: updated.id,
        email: updated.email,
        error: error instanceof Error ? error.message : 'unknown_error',
      });
    }
  }

  logger.info('booking.confirm', {
    action: 'booking.confirm',
    outcome: 'ok',
    bookingId: updated.id,
    email: updated.email,
  });

  return NextResponse.json({ ok: true, state: 'confirmed' as const });
}
