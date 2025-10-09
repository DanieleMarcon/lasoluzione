import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { consumeBookingToken } from '@/lib/bookingVerification';
import { sendBookingEmails } from '@/lib/mailer';
import { normalizeStoredDinnerItems, normalizeStoredLunchItems } from '@/lib/lunchOrder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function mapErrorStatus(status: 'invalid' | 'expired' | 'used'): number {
  if (status === 'expired') return 410;
  if (status === 'used') return 409;
  return 400;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get('token') ?? '';

  const result = await consumeBookingToken(token);

  if (result.status !== 'ok') {
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

  const lunchItems = normalizeStoredLunchItems(updated.lunchItemsJson);
  const lunch = lunchItems.length
    ? {
        items: lunchItems,
        subtotalCents: updated.subtotalCents ?? 0,
        coverCents: updated.coverCents ?? 0,
        totalCents:
          updated.totalCents ?? (updated.subtotalCents ?? 0) + (updated.coverCents ?? 0) * updated.people,
      }
    : undefined;

  const dinnerItems = normalizeStoredDinnerItems((updated as any).dinnerItemsJson);
  const dinner = dinnerItems.length
    ? {
        items: dinnerItems,
        subtotalCents: (updated as any).dinnerSubtotalCents ?? 0,
        coverCents: (updated as any).dinnerCoverCents ?? 0,
        totalCents:
          (updated as any).dinnerTotalCents ??
          ((updated as any).dinnerSubtotalCents ?? 0) + ((updated as any).dinnerCoverCents ?? 0) * updated.people,
      }
    : undefined;

  try {
    await sendBookingEmails({
      id: updated.id,
      date: updated.date.toISOString(),
      people: updated.people,
      name: updated.name,
      email: updated.email,
      phone: updated.phone,
      notes: updated.notes ?? undefined,
      lunch,
      dinner,
      tierLabel: updated.tierLabel ?? undefined,
      tierPriceCents: updated.tierPriceCents ?? undefined,
    });
  } catch (error) {
    console.error('[bookings][confirm] email error', error);
  }

  return NextResponse.json({ ok: true, state: 'confirmed' as const });
}
