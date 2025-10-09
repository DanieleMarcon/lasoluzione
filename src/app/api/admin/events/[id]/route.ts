// src/app/api/admin/events/[id]/route.ts
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import { toAdminEventDTO } from '@/lib/admin/events-dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const paramsSchema = z.object({
  id: z.string(),
});

const isoStringSchema = z
  .string()
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), 'Formato data non valido');

const updateSchema = z
  .object({
    slug: z
      .string()
      .trim()
      .min(3)
      .max(100)
      .regex(SLUG_REGEX, { message: 'Usa lettere minuscole, numeri e trattini' })
      .optional(),
    title: z.string().trim().min(3).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    startAt: isoStringSchema.optional(),
    endAt: isoStringSchema.optional().nullable(),
    active: z.boolean().optional(),
    showOnHome: z.boolean().optional(),
    allowEmailOnlyBooking: z.boolean().optional(),
    capacity: z.number().int().min(1).optional().nullable(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Nessun campo da aggiornare',
  });

export async function PATCH(request: Request, context: { params: { id: string } }) {
  await assertAdmin();

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }

  const eventId = Number.parseInt(parsedParams.data.id, 10);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }

  let payload: z.infer<typeof updateSchema>;
  try {
    payload = updateSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'validation_error', details: error.flatten() },
        { status: 400 },
      );
    }
    throw error;
  }

  const existing = await prisma.eventInstance.findUnique({ where: { id: eventId } });
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  if (payload.slug && payload.slug !== existing.slug) {
    const conflict = await prisma.eventInstance.findUnique({ where: { slug: payload.slug } });
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
      nextEnd = new Date(payload.endAt);
      if (Number.isNaN(nextEnd.getTime())) {
        return NextResponse.json(
          { ok: false, error: 'invalid_end', message: 'Data di fine non valida' },
          { status: 400 },
        );
      }
    }
  }

  if (nextEnd && nextEnd <= nextStart) {
    return NextResponse.json(
      { ok: false, error: 'invalid_range', message: 'La fine deve essere successiva all\'inizio' },
      { status: 400 },
    );
  }

  const data: Prisma.EventInstanceUpdateInput = {};
  if (payload.slug !== undefined) data.slug = payload.slug;
  if (payload.title !== undefined) data.title = payload.title.trim();
  if (payload.description !== undefined) {
    data.description = payload.description?.trim() ? payload.description.trim() : null;
  }
  if (payload.startAt !== undefined) data.startAt = nextStart;
  if (payload.endAt !== undefined) data.endAt = nextEnd;
  if (payload.active !== undefined) data.active = payload.active;
  if (payload.showOnHome !== undefined) data.showOnHome = payload.showOnHome;
  if (payload.allowEmailOnlyBooking !== undefined)
    data.allowEmailOnlyBooking = payload.allowEmailOnlyBooking;
  if (payload.capacity !== undefined) data.capacity = payload.capacity ?? null;

  const updated = await prisma.eventInstance.update({
    where: { id: eventId },
    data,
  });

  return NextResponse.json({ ok: true, data: toAdminEventDTO(updated) });
}

export async function DELETE(request: Request, context: { params: { id: string } }) {
  await assertAdmin();

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }

  const eventId = Number.parseInt(parsedParams.data.id, 10);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }

  try {
    await prisma.eventInstance.delete({ where: { id: eventId } });
    return NextResponse.json({ ok: true, softDeleted: false });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2025') {
        return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
      }
      if (error.code === 'P2003') {
        await prisma.eventInstance.update({
          where: { id: eventId },
          data: { active: false },
        });
        return NextResponse.json({ ok: true, softDeleted: true });
      }
    }
    console.error('[admin][events][delete]', error);
    return NextResponse.json(
      { ok: false, error: 'delete_failed', message: 'Impossibile eliminare l\'evento' },
      { status: 500 },
    );
  }
}
