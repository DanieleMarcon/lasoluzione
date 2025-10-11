import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { logger } from '@/lib/logger';
import { consumeBookingToken } from '@/lib/bookingVerification';
import { formatEventSchedule } from '@/lib/date';
import { sendBookingConfirmedAdmin, sendBookingConfirmedCustomer } from '@/lib/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type BookingRecord = Awaited<ReturnType<typeof prisma.booking.findUnique>>;

type VerifyErrorCode = 'token_missing' | 'token_invalid' | 'token_expired' | 'config_error';

function resolveBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.APP_BASE_URL ??
    process.env.BASE_URL ??
    'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

function redirectToVerifyError(code: VerifyErrorCode, context: { bookingId?: string | null } = {}) {
  const baseUrl = resolveBaseUrl();
  const params = new URLSearchParams({ error: code });
  if (context.bookingId) {
    params.append('bookingId', context.bookingId);
  }
  const redirectUrl = `${baseUrl}/checkout/email-sent?${params.toString()}`;
  logger.warn('booking.confirm', {
    action: 'booking.confirm',
    outcome: 'invalid',
    reason: code,
    bookingId: context.bookingId ?? null,
  });
  return NextResponse.redirect(redirectUrl, { status: 302 });
}

function redirectToSuccess(bookingId: number, orderId: string | null) {
  const baseUrl = resolveBaseUrl();
  const params = new URLSearchParams();
  params.append('bookingId', String(bookingId));
  if (orderId) {
    params.append('orderId', orderId);
  }
  const redirectUrl = `${baseUrl}/checkout/success?${params.toString()}`;
  return NextResponse.redirect(redirectUrl, { status: 302 });
}

async function resolveEventDetails(booking: BookingRecord) {
  if (!booking) {
    return { title: 'La Soluzione', whenLabel: '' };
  }

  const eventInstanceId = (booking as { eventInstanceId?: unknown }).eventInstanceId;
  let eventInstance: { title: string | null; startAt: Date; endAt: Date | null } | null = null;

  if (typeof eventInstanceId === 'number' && Number.isFinite(eventInstanceId) && eventInstanceId > 0) {
    eventInstance = await prisma.eventInstance.findUnique({
      where: { id: eventInstanceId },
      select: { title: true, startAt: true, endAt: true },
    });
  } else if (booking.tierLabel) {
    eventInstance = await prisma.eventInstance.findFirst({
      where: { title: booking.tierLabel, startAt: booking.date },
      select: { title: true, startAt: true, endAt: true },
    });
  }

  const title = eventInstance?.title ?? booking.tierLabel ?? 'La Soluzione';
  const whenLabelRaw = formatEventSchedule(
    eventInstance?.startAt ?? booking.date,
    eventInstance?.endAt ?? undefined,
  );
  const whenLabel = whenLabelRaw.trim().length
    ? whenLabelRaw
    : (() => {
        try {
          return (eventInstance?.startAt ?? booking.date).toLocaleString('it-IT', {
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
      })();

  return { title, whenLabel };
}

export async function GET(request: Request) {
  let bookingIdParam: string | null = null;
  try {
    const url = new URL(request.url);
    bookingIdParam = url.searchParams.get('bookingId');
    const token = url.searchParams.get('token');

    if (!token) {
      return redirectToVerifyError('token_missing', { bookingId: bookingIdParam });
    }

    const result = await consumeBookingToken(token);

    if (result.status === 'expired') {
      return redirectToVerifyError('token_expired', { bookingId: bookingIdParam });
    }

    if (result.status !== 'ok' || !result.booking) {
      return redirectToVerifyError('token_invalid', { bookingId: bookingIdParam });
    }

    const bookingId = result.booking.id;

    const confirmation = await prisma.$transaction(async (tx) => {
      const fresh = await tx.booking.findUnique({ where: { id: bookingId } });
      if (!fresh) {
        return { status: 'not_found' as const, booking: null };
      }

      if (fresh.status === 'confirmed') {
        await tx.bookingVerification.updateMany({
          where: { bookingId: fresh.id, usedAt: null },
          data: { usedAt: new Date() },
        });
        return { status: 'already_confirmed' as const, booking: fresh };
      }

      const updated = await tx.booking.update({
        where: { id: fresh.id },
        data: { status: 'confirmed' },
      });

      await tx.bookingVerification.updateMany({
        where: { bookingId: fresh.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      if (fresh.orderId) {
        await tx.order.update({
          where: { id: fresh.orderId },
          data: { status: 'confirmed' },
        });
      }

      return { status: 'ok' as const, booking: updated };
    });

    if (!confirmation.booking) {
      return redirectToVerifyError('token_invalid', { bookingId: bookingIdParam });
    }

    const { booking } = confirmation;
    const baseUrl = resolveBaseUrl();
    const { title, whenLabel } = await resolveEventDetails(booking);
    const people = typeof booking.people === 'number' ? booking.people : 1;

    if (confirmation.status === 'ok') {
      try {
        await sendBookingConfirmedCustomer({
          to: booking.email,
          bookingId: booking.id,
          eventTitle: title,
          whenLabel,
          people,
          baseUrl,
        });
      } catch (error) {
        console.error('[booking.confirm] customer email failed', error);
      }

      try {
        await sendBookingConfirmedAdmin({
          to: process.env.MAIL_TO_BOOKINGS ?? '',
          bookingId: booking.id,
          customerName: booking.name,
          customerEmail: booking.email,
          customerPhone: booking.phone ?? '',
          eventTitle: title,
          whenLabel,
          people,
        });
      } catch (error) {
        console.error('[booking.confirm] admin email failed', error);
      }

      logger.info('booking.confirm', {
        action: 'booking.confirm',
        bookingId: booking.id,
        eventInstanceId: (booking as any).eventInstanceId ?? null,
        email: booking.email,
        outcome: 'ok',
      });
    } else {
      logger.info('booking.confirm', {
        action: 'booking.confirm',
        bookingId: booking.id,
        eventInstanceId: (booking as any).eventInstanceId ?? null,
        email: booking.email,
        outcome: 'already_confirmed',
      });
    }

    return redirectToSuccess(booking.id, booking.orderId ?? null);
  } catch (error) {
    logger.error('booking.confirm', {
      action: 'booking.confirm',
      bookingId: bookingIdParam ?? null,
      outcome: 'error',
      error: error instanceof Error ? error.message : 'unknown_error',
    });
    return redirectToVerifyError('config_error', { bookingId: bookingIdParam });
  }
}

