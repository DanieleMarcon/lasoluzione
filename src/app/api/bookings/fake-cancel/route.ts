import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const bodySchema = z.object({
  token: z.string().min(1, 'Token mancante'),
});

export async function POST(req: Request) {
  console.log('[POST /api/bookings/fake-cancel] start');
  try {
    const json = await req.json();
    const { token } = bodySchema.parse(json);

    const booking = await prisma.booking.findFirst({
      where: { prepayToken: token, status: 'pending_payment' },
    });

    if (!booking) {
      console.warn('[POST /api/bookings/fake-cancel] token not found', token);
      return NextResponse.json({ ok: false, error: 'Pagamento non trovato' }, { status: 404 });
    }

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: 'failed', prepayToken: null },
    });

    console.log('[POST /api/bookings/fake-cancel] ok', booking.id);
    return NextResponse.json({ ok: true, bookingId: booking.id }, { status: 200 });
  } catch (err: any) {
    if (err?.name === 'ZodError') {
      console.error('[POST /api/bookings/fake-cancel] ZodError:', err.flatten?.());
      return NextResponse.json(
        { ok: false, error: 'Dati non validi', details: err.flatten?.() },
        { status: 400 }
      );
    }
    console.error('[POST /api/bookings/fake-cancel] error:', err);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
