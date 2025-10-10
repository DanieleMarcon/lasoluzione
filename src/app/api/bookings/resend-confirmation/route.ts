import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { issueBookingToken } from '@/lib/bookingVerification';
import { sendBookingVerifyEmail } from '@/lib/mailer';
import { logger } from '@/lib/logger';
import { assertCooldownOrThrow } from '@/lib/rateLimit';
import { formatEventSchedule } from '@/lib/date';

type BookingRecord = Awaited<ReturnType<typeof prisma.booking.findUnique>>;

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const payloadSchema = z.object({
  bookingId: z.number().int().positive(),
});

function resolveBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.APP_BASE_URL ?? '';
  return raw.replace(/\/$/, '');
}

async function resolveEventDetails(booking: BookingRecord) {
  if (!booking) {
    return { title: booking?.tierLabel ?? 'La Soluzione', whenLabel: '' };
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

function extractClientIp(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  if (forwarded) {
    const parts = forwarded.split(',');
    if (parts.length) {
      return parts[0].trim();
    }
  }
  const realIp = req.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'local';
}

export async function POST(req: Request) {
  let booking: Awaited<ReturnType<typeof prisma.booking.findUnique>> | null = null;
  try {
    const body = await req.json();
    const parsed = payloadSchema.parse(body);

    booking = await prisma.booking.findUnique({ where: { id: parsed.bookingId } });

    if (!booking) {
      return NextResponse.json({ ok: false, error: 'booking_not_found' }, { status: 404 });
    }

    if (booking.status !== 'pending') {
      logger.warn('booking.resend', {
        action: 'booking.resend',
        bookingId: booking.id,
        eventInstanceId: (booking as any).eventInstanceId ?? null,
        email: booking.email,
        outcome: 'not_pending',
      });
      return NextResponse.json({ ok: false, error: 'not_pending' }, { status: 400 });
    }

    const ip = extractClientIp(req);
    const emailKey = booking.email.trim().toLowerCase();
    const key = `${emailKey}|${ip}`;

    try {
      assertCooldownOrThrow({ key });
    } catch (error) {
      if ((error as any)?.status === 429) {
        const retryAfter = Number((error as any)?.retryAfter) || 0;
        const message = error instanceof Error ? error.message : 'rate_limited';
        logger.warn('booking.resend', {
          action: 'booking.resend',
          bookingId: booking.id,
          eventInstanceId: (booking as any).eventInstanceId ?? null,
          email: booking.email,
          outcome: 'rate_limited',
          retryAfter,
        });
        const response = NextResponse.json(
          { ok: false, error: message },
          { status: 429 },
        );
        if (retryAfter > 0) {
          response.headers.set('Retry-After', String(retryAfter));
        }
        return response;
      }
      throw error;
    }

    const nowDate = new Date();
    await prisma.bookingVerification.updateMany({
      where: {
        bookingId: booking.id,
        usedAt: null,
        expiresAt: { gt: nowDate },
      },
      data: { usedAt: nowDate },
    });

    const verification = await issueBookingToken(booking.id, booking.email);

    const baseUrl = resolveBaseUrl();
    const { title, whenLabel } = await resolveEventDetails(booking);

    await sendBookingVerifyEmail({
      to: booking.email,
      bookingId: booking.id,
      token: verification.token,
      eventTitle: title,
      whenLabel,
      baseUrl,
    });

    logger.info('booking.resend', {
      action: 'booking.resend',
      bookingId: booking.id,
      eventInstanceId: (booking as any).eventInstanceId ?? null,
      email: booking.email,
      tokenId: verification.id,
      outcome: 'ok',
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: 'invalid_payload', details: error.flatten() }, { status: 400 });
    }
    logger.error('booking.resend', {
      action: 'booking.resend',
      bookingId: booking?.id ?? null,
      eventInstanceId: (booking as any)?.eventInstanceId ?? null,
      email: booking?.email ?? null,
      outcome: 'error',
      error: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
