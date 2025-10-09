import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { issueBookingToken } from '@/lib/bookingVerification';
import { sendBookingRequestConfirmationEmail } from '@/lib/mailer';
import { logger } from '@/lib/logger';
import { assertCooldownOrThrow } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const payloadSchema = z.object({
  bookingId: z.number().int().positive(),
});

function resolveBaseUrl(): string {
  const raw =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.BASE_URL ||
    'http://localhost:3000';
  return raw.replace(/\/$/, '');
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
    const confirmUrl = `${baseUrl}/checkout/confirm?token=${encodeURIComponent(verification.token)}`;

    await sendBookingRequestConfirmationEmail({
      booking,
      event: { title: booking.tierLabel ?? undefined, startAt: booking.date },
      confirmUrl,
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
