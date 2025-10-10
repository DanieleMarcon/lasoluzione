// src/app/api/admin/events/[id]/route.ts
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import type { EventItem } from '@prisma/client';
import { z } from 'zod';

import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import { eventItemIdSchema, eventItemUpdateSchema } from '@/lib/validators/eventItem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  id: eventItemIdSchema,
});

function toAdminEventItemDTO(event: EventItem) {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description ?? null,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt ? event.endAt.toISOString() : null,
    active: event.active,
    showOnHome: event.showOnHome,
    emailOnly: event.emailOnly,
    capacity: event.capacity ?? null,
    priceCents: event.priceCents,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  await assertAdmin();

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }

  const eventId = parsedParams.data.id;

  let payload: z.infer<typeof eventItemUpdateSchema>;
  try {
    payload = eventItemUpdateSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'validation_error', details: error.flatten() },
        { status: 400 },
      );
    }
    throw error;
  }

  const existing = await prisma.eventItem.findUnique({ where: { id: eventId } });
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  if (payload.slug && payload.slug !== existing.slug) {
    const conflict = await prisma.eventItem.findUnique({ where: { slug: payload.slug } });
    if (conflict) {
      return NextResponse.json(
        { ok: false, error: 'slug_conflict', message: 'Slug già in uso' },
        { status: 409 },
      );
    }
  }

  const nextStart = payload.startAt ? new Date(payload.startAt) : existing.startAt;
  if (payload.startAt && Number.isNaN(nextStart.getTime())) {
    return NextResponse.json(
      { ok: false, error: 'invalid_start', message: 'Data di inizio non valida' },
      { status: 400 },
    );
  }

  let nextEnd: Date | null = existing.endAt;
  if (payload.endAt !== undefined) {
    if (payload.endAt === null) {
      nextEnd = null;
    } else {
      const parsedEnd = new Date(payload.endAt);
      if (Number.isNaN(parsedEnd.getTime())) {
        return NextResponse.json(
          { ok: false, error: 'invalid_end', message: 'Data di fine non valida' },
          { status: 400 },
        );
      }
      nextEnd = parsedEnd;
    }
  }

  if (nextEnd && nextEnd <= nextStart) {
    return NextResponse.json(
      { ok: false, error: 'invalid_range', message: 'La fine deve essere successiva all\'inizio' },
      { status: 400 },
    );
  }

  const data: Prisma.EventItemUpdateInput = {};
  if (payload.slug !== undefined) data.slug = payload.slug;
  if (payload.title !== undefined) data.title = payload.title.trim();
  if (payload.description !== undefined) {
    data.description = payload.description?.trim() ? payload.description.trim() : null;
  }
  if (payload.startAt !== undefined) data.startAt = nextStart;
  if (payload.endAt !== undefined) data.endAt = nextEnd;
  if (payload.active !== undefined) data.active = payload.active;
  if (payload.showOnHome !== undefined) data.showOnHome = payload.showOnHome;
  if (payload.emailOnly !== undefined) data.emailOnly = payload.emailOnly;
  if (payload.capacity !== undefined) data.capacity = payload.capacity ?? null;
  if (payload.priceCents !== undefined) data.priceCents = payload.priceCents;

  const updated = await prisma.eventItem.update({
    where: { id: eventId },
    data,
  });

  return NextResponse.json({ ok: true, data: toAdminEventItemDTO(updated) });
}

export async function DELETE(request: Request, context: { params: { id: string } }) {
  await assertAdmin();

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }

  const eventId = parsedParams.data.id;

  try {
    await prisma.eventItem.delete({ where: { id: eventId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2025') {
      return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
    }

    console.error('[admin][events][delete]', error);
    return NextResponse.json(
      { ok: false, error: 'delete_failed', message: "Impossibile eliminare l'evento" },
      { status: 500 },
    );
  }
}
