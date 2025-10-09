import { randomBytes, timingSafeEqual } from 'crypto';
import { Prisma } from '@prisma/client';
import type { Booking, BookingVerification } from '@prisma/client';

import { prisma } from './prisma';

const DEFAULT_TTL_HOURS = 48;
const TOKEN_LENGTH_BYTES = 32; // produces 64 hex chars
const NONCE_LENGTH_BYTES = 8; // produces 16 hex chars

function addHours(base: Date, hours: number): Date {
  const date = new Date(base);
  date.setTime(date.getTime() + hours * 60 * 60 * 1000);
  return date;
}

function timingSafeEqualString(a: string, b: string): boolean {
  const bufferA = Buffer.from(a, 'utf8');
  const bufferB = Buffer.from(b, 'utf8');

  if (bufferA.length !== bufferB.length) {
    return false;
  }

  try {
    return timingSafeEqual(bufferA, bufferB);
  } catch {
    return false;
  }
}

function generateToken(): string {
  return randomBytes(TOKEN_LENGTH_BYTES).toString('hex');
}

function generateNonce(): string {
  return randomBytes(NONCE_LENGTH_BYTES).toString('hex');
}

export async function cleanupExpiredTokens(): Promise<void> {
  const now = new Date();

  try {
    await prisma.bookingVerification.deleteMany({
      where: {
        expiresAt: { lt: now },
        usedAt: null,
      },
    });
  } catch (error) {
    // Best effort cleanup. Swallow errors to avoid affecting callers.
  }
}

export async function issueBookingToken(
  bookingId: number,
  email: string,
  ttlHours: number = DEFAULT_TTL_HOURS,
): Promise<BookingVerification> {
  await cleanupExpiredTokens();

  const effectiveTtl = Number.isFinite(ttlHours) && ttlHours > 0 ? ttlHours : DEFAULT_TTL_HOURS;
  const expiresAt = addHours(new Date(), effectiveTtl);

  let attempt = 0;
  const maxAttempts = 5;

  while (attempt < maxAttempts) {
    attempt += 1;

    const token = generateToken();
    const nonce = generateNonce();

    try {
      const verification = await prisma.bookingVerification.create({
        data: {
          bookingId,
          email,
          token,
          nonce,
          expiresAt,
        },
      });

      return verification;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        continue;
      }

      throw error;
    }
  }

  throw new Error('Unable to generate a unique booking verification token');
}

export type ConsumeBookingTokenResult =
  | { status: 'ok'; booking: Booking }
  | { status: 'invalid' | 'expired' | 'used'; booking: null };

export async function consumeBookingToken(token: string): Promise<ConsumeBookingTokenResult> {
  if (!token) {
    return { status: 'invalid', booking: null };
  }

  await cleanupExpiredTokens();

  const now = new Date();

  return prisma.$transaction(async (tx) => {
    const verification = await tx.bookingVerification.findUnique({
      where: { token },
    });

    if (!verification) {
      return { status: 'invalid', booking: null };
    }

    if (!timingSafeEqualString(token, verification.token)) {
      return { status: 'invalid', booking: null };
    }

    if (verification.usedAt) {
      return { status: 'used', booking: null };
    }

    if (verification.expiresAt <= now) {
      return { status: 'expired', booking: null };
    }

    const updateResult = await tx.bookingVerification.updateMany({
      where: {
        id: verification.id,
        usedAt: null,
        expiresAt: { gt: now },
      },
      data: {
        usedAt: now,
      },
    });

    if (updateResult.count !== 1) {
      const fresh = await tx.bookingVerification.findUnique({ where: { id: verification.id } });
      if (fresh?.usedAt) {
        return { status: 'used', booking: null };
      }
      if (fresh && fresh.expiresAt <= now) {
        return { status: 'expired', booking: null };
      }
      return { status: 'invalid', booking: null };
    }

    const booking = await tx.booking.findUnique({
      where: { id: verification.bookingId },
    });

    if (!booking) {
      return { status: 'invalid', booking: null };
    }

    return { status: 'ok', booking };
  });
}
