import { randomUUID } from 'crypto';

import { NextResponse } from 'next/server';

import { bookingSchema } from '@/components/booking/validation';
import { prisma } from '@/lib/prisma';
import { getBookingSettings, resolveBookingDate, typeRequiresPrepay } from '@/lib/bookingSettings';
import { buildLunchOrderSummary, buildDinnerOrderSummary } from '@/lib/lunchOrder';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bookingSchema.parse(json);

    const settings = await getBookingSettings();

    if (!settings.enabledTypes.includes(parsed.type)) {
      console.warn('[POST /api/bookings/prepay] type not allowed', parsed.type);
      return NextResponse.json(
        { ok: false, error: 'Tipologia non disponibile' },
        { status: 400 }
      );
    }

    if (!typeRequiresPrepay(settings, parsed.type)) {
      return NextResponse.json(
        { ok: false, error: 'Questa tipologia non richiede pagamento anticipato.' },
        { status: 400 }
      );
    }

    if (!settings.enableDateTimeStep && (!settings.fixedDate || !settings.fixedTime)) {
      console.error('[POST /api/bookings/prepay] Fixed date/time misconfigured');
      return NextResponse.json(
        { ok: false, error: 'Configurazione prenotazioni non valida' },
        { status: 500 }
      );
    }

    const date = resolveBookingDate(settings, parsed.date, parsed.time);
    const token = randomUUID();

    let tierInfo: { id: string; label: string; priceCents: number; type: 'evento' | 'aperitivo' } | null = null;
    if (parsed.type === 'evento' || parsed.type === 'aperitivo') {
      if (!parsed.tierId || parsed.tierPriceCents == null || !parsed.tierLabel) {
        return NextResponse.json({ ok: false, error: 'tier_missing' }, { status: 400 });
      }

      const tierRow = await prisma.eventTier.findUnique({ where: { id: parsed.tierId } });
      if (!tierRow || !tierRow.active) {
        return NextResponse.json({ ok: false, error: 'tier_unavailable' }, { status: 409 });
      }

      if (tierRow.type !== parsed.type || (parsed.tierType && parsed.tierType !== parsed.type)) {
        return NextResponse.json({ ok: false, error: 'tier_mismatch' }, { status: 400 });
      }

      if (tierRow.label !== parsed.tierLabel || tierRow.priceCents !== parsed.tierPriceCents) {
        return NextResponse.json({ ok: false, error: 'tier_outdated' }, { status: 409 });
      }

      tierInfo = {
        id: tierRow.id,
        label: tierRow.label,
        priceCents: tierRow.priceCents,
        type: tierRow.type,
      };
    }

    let lunchSummary: Awaited<ReturnType<typeof buildLunchOrderSummary>> | null = null;
    let dinnerSummary: Awaited<ReturnType<typeof buildDinnerOrderSummary>> | null = null;
    if (parsed.type === 'pranzo') {
      try {
        lunchSummary = await buildLunchOrderSummary(parsed.lunchOrder, parsed.people, settings.coverCents);
      } catch (error: any) {
        console.warn('[POST /api/bookings/prepay] lunch order error', error);
        const code = typeof error?.message === 'string' ? error.message : 'LUNCH_ERROR';
        if (code === 'LUNCH_DISH_NOT_FOUND' || code === 'LUNCH_DISH_INACTIVE') {
          return NextResponse.json({ ok: false, error: 'dish_unavailable' }, { status: 409 });
        }
        if (code === 'LUNCH_NO_ITEMS') {
          return NextResponse.json({ ok: false, error: 'no_items' }, { status: 400 });
        }
        if (code === 'LUNCH_INVALID_QTY' || code === 'LUNCH_QTY_TOO_HIGH' || code === 'LUNCH_TOTAL_TOO_HIGH') {
          return NextResponse.json({ ok: false, error: 'invalid_order' }, { status: 400 });
        }
        return NextResponse.json({ ok: false, error: 'invalid_order' }, { status: 400 });
      }
    }

    if (parsed.type === 'cena') {
      try {
        dinnerSummary = await buildDinnerOrderSummary(parsed.lunchOrder, parsed.people, settings.dinnerCoverCents);
      } catch (error: any) {
        console.warn('[POST /api/bookings/prepay] dinner order error', error);
        const code = typeof error?.message === 'string' ? error.message : 'DINNER_ERROR';
        if (
          code === 'DINNER_DISH_NOT_FOUND' ||
          code === 'DINNER_DISH_INACTIVE' ||
          code === 'DINNER_DISH_NOT_AVAILABLE'
        ) {
          return NextResponse.json({ ok: false, error: 'dish_unavailable' }, { status: 409 });
        }
        if (code === 'DINNER_NO_ITEMS') {
          return NextResponse.json({ ok: false, error: 'no_items' }, { status: 400 });
        }
        if (
          code === 'DINNER_INVALID_QTY' ||
          code === 'DINNER_QTY_TOO_HIGH' ||
          code === 'DINNER_TOTAL_TOO_HIGH'
        ) {
          return NextResponse.json({ ok: false, error: 'invalid_order' }, { status: 400 });
        }
        return NextResponse.json({ ok: false, error: 'invalid_order' }, { status: 400 });
      }
    }

    const created = await prisma.booking.create({
      data: {
        date,
        people: parsed.people,
        type: parsed.type,
        name: parsed.name,
        email: parsed.email,
        phone: parsed.phone,
        notes: parsed.notes ?? null,
        agreePrivacy: parsed.agreePrivacy,
        agreeMarketing: parsed.agreeMarketing ?? false,
        status: 'pending_payment',
        prepayToken: token,
        lunchItemsJson: lunchSummary ? lunchSummary.items : undefined,
        coverCents: lunchSummary ? lunchSummary.coverCents : null,
        subtotalCents: lunchSummary ? lunchSummary.subtotalCents : null,
        totalCents: lunchSummary ? lunchSummary.totalCents : null,
        dinnerItemsJson: dinnerSummary ? dinnerSummary.items : undefined,
        dinnerCoverCents: dinnerSummary ? dinnerSummary.coverCents : null,
        dinnerSubtotalCents: dinnerSummary ? dinnerSummary.subtotalCents : null,
        dinnerTotalCents: dinnerSummary ? dinnerSummary.totalCents : null,
        tierType: tierInfo?.type ?? null,
        tierLabel: tierInfo?.label ?? null,
        tierPriceCents: tierInfo?.priceCents ?? null,
      },
    });

    return NextResponse.json(
      {
        ok: true,
        bookingId: created.id,
        paymentUrl: `/fake-payment?token=${encodeURIComponent(token)}`,
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      console.error('[POST /api/bookings/prepay] ZodError:', err.flatten?.());
      return NextResponse.json(
        { ok: false, error: 'Dati non validi', details: err.flatten?.() },
        { status: 400 }
      );
    }
    console.error('[POST /api/bookings/prepay] error:', err);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
