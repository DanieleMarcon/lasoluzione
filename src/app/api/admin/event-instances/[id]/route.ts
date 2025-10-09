// src/app/api/admin/event-instances/[id]/route.ts
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  id: z.string(),
});

const payloadSchema = z.object({
  allowEmailOnlyBooking: z.boolean(),
});

export async function PATCH(
  req: Request,
  { params }: { params: { id: string } },
) {
  await assertAdmin();

  const parsedParams = paramsSchema.safeParse(params);
  if (!parsedParams.success) {
    return NextResponse.json({ error: 'Identificativo non valido' }, { status: 400 });
  }

  const eventId = Number.parseInt(parsedParams.data.id, 10);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ error: 'Identificativo non valido' }, { status: 400 });
  }

  let payload: z.infer<typeof payloadSchema>;
  try {
    payload = payloadSchema.parse(await req.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dati non validi', details: error.flatten() }, { status: 400 });
    }
    throw error;
  }

  try {
    const updated = await prisma.eventInstance.update({
      where: { id: eventId },
      data: { allowEmailOnlyBooking: payload.allowEmailOnlyBooking },
      select: {
        id: true,
        allowEmailOnlyBooking: true,
      },
    });

    return NextResponse.json({ ok: true, data: updated });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ error: 'Evento non trovato' }, { status: 404 });
    }
    console.error('[admin][event-instances][patch]', error);
    return NextResponse.json({ error: "Impossibile aggiornare l'evento" }, { status: 500 });
  }
}
