// src/app/api/admin/bookings/[id]/confirm/route.ts
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { assertAdmin } from '@/lib/admin/session';
import { toAdminBookingDTO } from '@/lib/admin/booking-dto';
import { sendBookingEmails } from '@/lib/mailer';
import { normalizeStoredLunchItems, normalizeStoredDinnerItems } from '@/lib/lunchOrder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function asBookingId(param: string | null) {
  if (!param) return null;
  const parsed = Number.parseInt(param, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function POST(_: Request, context: { params: { id: string } }) {
  await assertAdmin();

  const id = asBookingId(context.params.id);
  if (!id) {
    return NextResponse.json({ error: 'ID non valido' }, { status: 400 });
  }

  const booking = await prisma.booking.findUnique({ where: { id } });
  if (!booking) {
    return NextResponse.json({ error: 'Prenotazione non trovata' }, { status: 404 });
  }

  const updated = await prisma.booking.update({
    where: { id },
    data: { status: 'confirmed', prepayToken: null },
  });

  const lunchItems = normalizeStoredLunchItems(booking.lunchItemsJson);
  const lunch = lunchItems.length
    ? {
        items: lunchItems,
        subtotalCents: booking.subtotalCents ?? 0,
        coverCents: booking.coverCents ?? 0,
        totalCents:
          booking.totalCents ?? (booking.subtotalCents ?? 0) + (booking.coverCents ?? 0) * booking.people,
      }
    : undefined;

  const dinnerItems = normalizeStoredDinnerItems((booking as any).dinnerItemsJson);
  const dinner = dinnerItems.length
    ? {
        items: dinnerItems,
        subtotalCents: (booking as any).dinnerSubtotalCents ?? 0,
        coverCents: (booking as any).dinnerCoverCents ?? 0,
        totalCents:
          (booking as any).dinnerTotalCents ??
          ((booking as any).dinnerSubtotalCents ?? 0) + ((booking as any).dinnerCoverCents ?? 0) * booking.people,
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
      tierLabel: booking.tierLabel ?? undefined,
      tierPriceCents: booking.tierPriceCents ?? undefined,
    });
  } catch (error) {
    console.error('[admin][confirm booking] mail error', error);
    return NextResponse.json(
      {
        ok: true,
        data: toAdminBookingDTO(updated),
        warning: 'Prenotazione confermata ma invio email fallito',
      },
      { status: 200 }
    );
  }

  return NextResponse.json({ ok: true, data: toAdminBookingDTO(updated) });
}
