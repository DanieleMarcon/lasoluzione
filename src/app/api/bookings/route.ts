// src/app/api/bookings/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendBookingEmails } from '@/lib/mailer';
import { bookingSchema } from '@/components/booking/validation';

// Nodemailer ha bisogno di runtime Node (non Edge)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toDate(dateStr: string, timeStr: string): Date {
  // costruiamo un ISO locale tipo "2025-10-15T20:00:00"
  // NB: interpretiamo come ora locale del server di sviluppo
  const iso = `${dateStr}T${timeStr}:00`;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) throw new Error('Invalid date/time');
  return d;
}

export async function POST(req: Request) {
  try {
    const json = await req.json();
    const parsed = bookingSchema.parse(json);

    const date = toDate(parsed.date, parsed.time);

    const created = await prisma.booking.create({
      data: {
        date,
        people: parsed.people,
        type: parsed.type,
        name: parsed.name,
        email: parsed.email,
        phone: parsed.phone ?? null,
        notes: parsed.notes ?? null,
        agreePrivacy: parsed.agreePrivacy,
        agreeMarketing: parsed.agreeMarketing ?? false
      }
    });

    try {
      await sendBookingEmails({
        id: created.id,
        date: created.date.toISOString(),
        people: created.people,
        name: created.name,
        email: created.email,
        phone: created.phone ?? undefined,
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
