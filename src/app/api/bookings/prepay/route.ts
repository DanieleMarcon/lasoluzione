import { randomUUID } from 'crypto';
import { NextResponse } from 'next/server';
import { bookingSchema } from '@/components/booking/validation';
import { prisma } from '@/lib/prisma';
import { getBookingSettings, resolveBookingDate } from '@/lib/bookingSettings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  console.log('[POST /api/bookings/prepay] start');
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

    if (!settings.prepayTypes.includes(parsed.type)) {
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
      },
    });

    console.log('[POST /api/bookings/prepay] pending', created.id);
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
