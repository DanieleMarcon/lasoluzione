import { NextResponse } from 'next/server';
import type { EventItem } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import { eventItemIdSchema } from '@/lib/validators/eventItem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  sectionId: z.string().trim().min(1, 'Sezione obbligatoria'),
});

const assignSchema = z.object({
  eventId: eventItemIdSchema,
  order: z.number().int().min(0).optional(),
  featured: z.boolean().optional(),
  showInHome: z.boolean().optional(),
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

export async function GET(request: Request, context: { params: { sectionId: string } }) {
  await assertAdmin();

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ ok: false, error: 'invalid_section' }, { status: 400 });
  }

  const sectionId = parsedParams.data.sectionId;

  const section = await prisma.catalogSection.findUnique({ where: { key: sectionId } });
  if (!section) {
    return NextResponse.json({ ok: false, error: 'section_not_found' }, { status: 404 });
  }

  const assignments = await prisma.sectionEvent.findMany({
    where: { sectionId },
    orderBy: [{ order: 'asc' }, { eventId: 'asc' }],
  });

  const eventIds = assignments.map((item) => item.eventId);
  const events = eventIds.length
    ? await prisma.eventItem.findMany({ where: { id: { in: eventIds } } })
    : [];

  const eventsMap = new Map(events.map((event) => [event.id, event]));

  const data = assignments.map((assignment) => ({
    sectionId: assignment.sectionId,
    eventId: assignment.eventId,
    order: assignment.order,
    featured: assignment.featured,
    showInHome: assignment.showInHome,
    event: eventsMap.has(assignment.eventId)
      ? toAdminEventItemDTO(eventsMap.get(assignment.eventId) as EventItem)
      : null,
  }));

  return NextResponse.json({ ok: true, data });
}

export async function POST(request: Request, context: { params: { sectionId: string } }) {
  await assertAdmin();

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ ok: false, error: 'invalid_section' }, { status: 400 });
  }

  const sectionId = parsedParams.data.sectionId;

  const section = await prisma.catalogSection.findUnique({ where: { key: sectionId } });
  if (!section) {
    return NextResponse.json({ ok: false, error: 'section_not_found' }, { status: 404 });
  }

  let payload: z.infer<typeof assignSchema>;
  try {
    payload = assignSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'validation_error', details: error.flatten() },
        { status: 400 },
      );
    }
    throw error;
  }

  const event = await prisma.eventItem.findUnique({ where: { id: payload.eventId } });
  if (!event) {
    return NextResponse.json({ ok: false, error: 'event_not_found' }, { status: 404 });
  }

  const existingAssignment = await prisma.sectionEvent.findUnique({
    where: {
      sectionId_eventId: {
        sectionId,
        eventId: payload.eventId,
      },
    },
  });

  const updateData: Prisma.SectionEventUpdateInput = {};
  if (payload.order !== undefined) updateData.order = payload.order;
  if (payload.featured !== undefined) updateData.featured = payload.featured;
  if (payload.showInHome !== undefined) updateData.showInHome = payload.showInHome;

  const upserted = await prisma.sectionEvent.upsert({
    where: {
      sectionId_eventId: {
        sectionId,
        eventId: payload.eventId,
      },
    },
    update: updateData,
    create: {
      sectionId,
      eventId: payload.eventId,
      order: payload.order ?? 0,
      featured: payload.featured ?? false,
      showInHome: payload.showInHome ?? false,
    },
  });

  const status = existingAssignment ? 200 : 201;

  return NextResponse.json(
    {
      ok: true,
      data: {
        sectionId: upserted.sectionId,
        eventId: upserted.eventId,
        order: upserted.order,
        featured: upserted.featured,
        showInHome: upserted.showInHome,
        event: toAdminEventItemDTO(event),
        created: !existingAssignment,
      },
    },
    { status },
  );
}
