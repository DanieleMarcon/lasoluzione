// src/app/api/admin/bookings/[id]/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { BookingType, Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { assertAdmin } from '@/lib/admin/session';
import { getBookingSettings, resolveBookingDate } from '@/lib/bookingSettings';
import { toAdminBookingDTO } from '@/lib/admin/booking-dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    people: z.coerce.number().int().min(1).max(40).optional(),
    phone: z.string().min(3).max(30).optional(),
    notes: z.string().max(1000).or(z.null()).optional(),
    type: z.string().optional(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
    time: z.string().regex(/^\d{2}:\d{2}$/).optional(),
  })
  .refine(
    (value) => {
      if (!value.date && !value.time) return true;
      return Boolean(value.date && value.time);
    },
    {
      message: 'Per aggiornare data e ora sono richiesti entrambi i campi',
      path: ['time'],
    }
  );

function asBookingId(param: string | null) {
  if (!param) return null;
  const parsed = Number.parseInt(param, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

export async function PATCH(req: Request, context: { params: { id: string } }) {
  await assertAdmin();

  const id = asBookingId(context.params.id);
  if (!id) {
    return NextResponse.json({ error: 'ID non valido' }, { status: 400 });
  }

  let payload;
  try {
    payload = updateSchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dati non validi', details: error.flatten() }, { status: 400 });
    }
    throw error;
  }

  const data: Prisma.BookingUpdateInput = {};
  let settings: Awaited<ReturnType<typeof getBookingSettings>> | null = null;

  if (payload.name) data.name = payload.name;
  if (payload.people) data.people = payload.people;
  if (payload.phone) data.phone = payload.phone;
  if (payload.notes !== undefined) data.notes = payload.notes ?? null;

  if (payload.type) {
    settings = settings ?? (await getBookingSettings());
    const allowedTypes = settings.enabledTypes;
    if (!allowedTypes.includes(payload.type as BookingType)) {
      return NextResponse.json({ error: 'Tipologia non consentita' }, { status: 400 });
    }
    data.type = payload.type as BookingType;
  }

  if (payload.date && payload.time) {
    settings = settings ?? (await getBookingSettings());
    if (!settings.enableDateTimeStep) {
      return NextResponse.json(
        { error: 'La modifica di data/ora è disabilitata dalle impostazioni' },
        { status: 400 }
      );
    }
    const nextDate = resolveBookingDate(settings, payload.date, payload.time);
    data.date = nextDate;
  }

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: 'Nessun campo da aggiornare' }, { status: 400 });
  }

  try {
    const updated = await prisma.booking.update({
      where: { id },
      data,
    });

    return NextResponse.json({ ok: true, data: toAdminBookingDTO(updated) });
  } catch (error) {
    console.error('[admin][PATCH booking]', error);
    return NextResponse.json({ error: "Errore durante l'aggiornamento" }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: { params: { id: string } }) {
  await assertAdmin();

  const id = asBookingId(context.params.id);
  if (!id) {
    return NextResponse.json({ error: 'ID non valido' }, { status: 400 });
  }

  try {
    await prisma.booking.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin][DELETE booking]', error);
    return NextResponse.json({ error: 'Impossibile eliminare la prenotazione' }, { status: 500 });
  }
}
