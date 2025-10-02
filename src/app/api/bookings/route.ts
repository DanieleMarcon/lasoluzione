// src/app/api/bookings/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendBookingEmails } from '@/lib/mailer';
import { bookingSchema } from '@/components/booking/validation';
import { getBookingSettings, resolveBookingDate, typeRequiresPrepay } from '@/lib/bookingSettings';

// Nodemailer ha bisogno di runtime Node (non Edge)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  console.log('[POST /api/bookings] start');
  try {
    const json = await req.json();
    const parsed = bookingSchema.parse(json);

    const settings = await getBookingSettings();

    if (!settings.enabledTypes.includes(parsed.type)) {
      console.warn('[POST /api/bookings] type not allowed', parsed.type);
      return NextResponse.json(
        { ok: false, error: 'Tipologia non disponibile' },
        { status: 400 }
      );
    }

    if (!settings.enableDateTimeStep && (!settings.fixedDate || !settings.fixedTime)) {
      console.error('[POST /api/bookings] Fixed date/time misconfigured');
      return NextResponse.json(
        { ok: false, error: 'Configurazione prenotazioni non valida' },
        { status: 500 }
      );
    }

    if (typeRequiresPrepay(settings, parsed.type)) {
      return NextResponse.json(
        {
          ok: false,
          requiresPrepay: true,
          message: 'Questa tipologia richiede pagamento anticipato.',
        },
        { status: 409 }
      );
    }

    const date = resolveBookingDate(settings, parsed.date, parsed.time);

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
        status: 'confirmed',
        prepayToken: null,
      }
    });

    try {
      await sendBookingEmails({
        id: created.id,
        date: created.date.toISOString(),
        people: created.people,
        name: created.name,
        email: created.email,
        phone: created.phone,
        notes: created.notes ?? undefined
      });
    } catch (mailErr) {
      console.error('[POST /api/bookings] Mailer error:', mailErr);
      return NextResponse.json(
        {
          ok: true,
          bookingId: created.id,
          warning:
            'Prenotazione salvata ma invio email fallito. Controlla le credenziali SMTP.'
        },
        { status: 201 }
      );
    }

    console.log('[POST /api/bookings] ok', created.id);
    return NextResponse.json({ ok: true, bookingId: created.id }, { status: 201 });
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      console.error('[POST /api/bookings] ZodError:', err.flatten?.());
      return NextResponse.json(
        { ok: false, error: 'Dati non validi', details: err.flatten?.() },
        { status: 400 }
      );
    }
    console.error('[POST /api/bookings] error:', err);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
