import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { sendBookingEmails } from '@/lib/mailer';
import { normalizeStoredLunchItems, normalizeStoredDinnerItems } from '@/lib/lunchOrder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  token: z.string().min(1, 'Token mancante'),
});

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const { token } = bodySchema.parse(json);

    const booking = await prisma.booking.findFirst({
      where: { prepayToken: token, status: 'pending_payment' },
    });

    if (!booking) {
      console.warn('[POST /api/bookings/fake-confirm] token not found', token);
      return NextResponse.json({ ok: false, error: 'Pagamento non trovato' }, { status: 404 });
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
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
        tierLabel: booking.tierLabel ?? undefined,
        tierPriceCents: booking.tierPriceCents ?? undefined,
        dinner,
      });
    } catch (mailErr) {
      console.error('[POST /api/bookings/fake-confirm] Mailer error:', mailErr);
      return NextResponse.json(
        {
          ok: true,
          bookingId: updated.id,
          warning: 'Prenotazione confermata ma invio email fallito. Controlla le credenziali SMTP.',
        },
        { status: 200 }
      );
    }

    return NextResponse.json({ ok: true, bookingId: updated.id }, { status: 200 });
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      console.error('[POST /api/bookings/fake-confirm] ZodError:', err.flatten?.());
      return NextResponse.json(
        { ok: false, error: 'Dati non validi', details: err.flatten?.() },
        { status: 400 }
      );
    }
    console.error('[POST /api/bookings/fake-confirm] error:', err);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
