// src/app/api/admin/bookings/[id]/cancel/route.ts
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { assertAdmin } from '@/lib/admin/session';
import { toAdminBookingDTO } from '@/lib/admin/booking-dto';
import { getTransport } from '@/lib/mailer';

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

  try {
    const updated = await prisma.booking.update({
      where: { id },
      data: { status: 'cancelled', prepayToken: null },
    });

    try {
      const from = process.env.MAIL_FROM;
      if (from) {
        const transport = getTransport();
        const when = updated.date;
        const dateHuman = when.toLocaleString('it-IT', {
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit',
        });

        const message = `Ciao ${updated.name},\n\nla tua prenotazione del ${dateHuman} è stata annullata su richiesta dello staff. ` +
          'Se desideri riprenotare contattaci pure.\n\nA presto!\nBar La Soluzione';

        await transport.sendMail({
          from,
          to: updated.email,
          subject: `Prenotazione annullata – Bar La Soluzione (#${updated.id})`,
          text: message,
        });
      }
    } catch (mailError) {
      console.warn('[admin][cancel booking] mail error', mailError);
    }

    return NextResponse.json({ ok: true, data: toAdminBookingDTO(updated) });
  } catch (error) {
    console.error('[admin][cancel booking]', error);
    return NextResponse.json({ error: 'Impossibile annullare la prenotazione' }, { status: 500 });
  }
}
