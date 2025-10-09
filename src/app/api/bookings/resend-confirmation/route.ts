import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { issueBookingToken } from '@/lib/bookingVerification';
import { sendBookingRequestConfirmationEmail } from '@/lib/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RATE_LIMIT_WINDOW_MS = 90_000;
const resendRateLimit = new Map<string, number>();

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
  return 'unknown';
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = payloadSchema.parse(body);

    const booking = await prisma.booking.findUnique({ where: { id: parsed.bookingId } });

    if (!booking) {
      return NextResponse.json({ ok: false, error: 'booking_not_found' }, { status: 404 });
    }

    if (booking.status !== 'pending') {
      return NextResponse.json({ ok: false, error: 'booking_not_pending' }, { status: 400 });
    }

    const emailKey = booking.email.trim().toLowerCase();
    const ip = extractClientIp(req);
    const key = `${ip}|${emailKey}`;
    const now = Date.now();
    const lastAttempt = resendRateLimit.get(key);
    if (lastAttempt && now - lastAttempt < RATE_LIMIT_WINDOW_MS) {
      return NextResponse.json({ ok: false, error: 'rate_limited' }, { status: 429 });
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

    resendRateLimit.set(key, now);

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: 'invalid_payload', details: error.flatten() }, { status: 400 });
    }
    console.error('[bookings][resend-confirmation] error', error);
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
