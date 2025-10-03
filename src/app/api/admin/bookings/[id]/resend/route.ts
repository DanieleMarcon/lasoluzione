// src/app/api/admin/bookings/[id]/resend/route.ts
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { assertAdmin } from '@/lib/admin/session';
import { sendBookingEmails } from '@/lib/mailer';
import { toAdminBookingDTO } from '@/lib/admin/booking-dto';

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

  try {
    await sendBookingEmails({
      id: booking.id,
      date: booking.date.toISOString(),
      people: booking.people,
      name: booking.name,
      email: booking.email,
      phone: booking.phone,
      notes: booking.notes ?? undefined,
    });
  } catch (error) {
    console.error('[admin][resend booking] mail error', error);
    return NextResponse.json(
      { error: 'Invio email fallito' },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, data: toAdminBookingDTO(booking) });
}
