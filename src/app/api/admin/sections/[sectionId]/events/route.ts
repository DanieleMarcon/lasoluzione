import { NextResponse } from 'next/server';
import { z } from 'zod';

import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const assignSchema = z.object({
  eventItemId: z.string().min(1),
  displayOrder: z.number().int().min(0).optional(),
  featured: z.boolean().optional(),
  showInHome: z.boolean().optional(),
});

async function resolveSectionId(sectionParam: string) {
  const numeric = Number.parseInt(sectionParam, 10);
  if (Number.isFinite(numeric) && numeric > 0) {
    const section = await prisma.catalogSection.findUnique({ where: { id: numeric } });
    if (section) return section;
  }

  return prisma.catalogSection.findUnique({ where: { key: sectionParam } });
}

function serializeAssignment(row: {
  sectionId: number;
  eventItemId: string;
  displayOrder: number;
  featured: boolean;
  showInHome: boolean;
  eventItem: {
    id: string;
    slug: string;
    title: string;
    startAt: Date;
    priceCents: number;
  };
}) {
  return {
    sectionId: row.sectionId,
    eventItemId: row.eventItemId,
    displayOrder: row.displayOrder,
    featured: row.featured,
    showInHome: row.showInHome,
    eventItem: {
      id: row.eventItem.id,
      slug: row.eventItem.slug,
      title: row.eventItem.title,
      startAt: row.eventItem.startAt.toISOString(),
      priceCents: row.eventItem.priceCents,
    },
  };
}

export async function GET(request: Request, context: { params: { sectionId: string } }) {
  await assertAdmin();

  const section = await resolveSectionId(context.params.sectionId.trim());
  if (!section) {
    return NextResponse.json({ ok: false, error: 'section_not_found' }, { status: 404 });
  }

  const assignments = await prisma.sectionEventItem.findMany({
    where: { sectionId: section.id },
    orderBy: [{ displayOrder: 'asc' }, { eventItemId: 'asc' }],
    include: { eventItem: true },
  });

  return NextResponse.json({
    ok: true,
    data: assignments.map((assignment) => ({
      sectionId: assignment.sectionId,
      eventId: assignment.eventItemId,
      order: assignment.displayOrder,
      featured: assignment.featured,
      showInHome: assignment.showInHome,
      event: {
        id: assignment.eventItem.id,
        slug: assignment.eventItem.slug,
        title: assignment.eventItem.title,
        startAt: assignment.eventItem.startAt.toISOString(),
        endAt: assignment.eventItem.endAt ? assignment.eventItem.endAt.toISOString() : null,
        priceCents: assignment.eventItem.priceCents,
        active: assignment.eventItem.active,
        emailOnly: assignment.eventItem.emailOnly,
        showOnHome: assignment.eventItem.showOnHome,
      },
    })),
  });
}

export async function POST(request: Request, context: { params: { sectionId: string } }) {
  await assertAdmin();

  const section = await resolveSectionId(context.params.sectionId.trim());
  if (!section) {
    return NextResponse.json({ ok: false, error: 'section_not_found' }, { status: 404 });
  }

  const json = await request.json().catch(() => ({}));
  const normalized = {
    ...json,
    eventItemId: json?.eventItemId ?? json?.eventId,
    displayOrder: json?.displayOrder ?? json?.order,
  };
  const parsed = assignSchema.safeParse(normalized);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: 'validation_error', details: parsed.error.flatten() }, { status: 400 });
  }

  const { eventItemId, displayOrder = 0, featured = false, showInHome = false } = parsed.data;

  const event = await prisma.eventItem.findUnique({ where: { id: eventItemId } });
  if (!event) {
    return NextResponse.json({ ok: false, error: 'event_not_found' }, { status: 404 });
  }

  const row = await prisma.sectionEventItem.upsert({
    where: {
      sectionId_eventItemId: {
        sectionId: section.id,
        eventItemId,
      },
    },
    update: {
      displayOrder,
      featured,
      showInHome,
    },
    create: {
      sectionId: section.id,
      eventItemId,
      displayOrder,
      featured,
      showInHome,
    },
    include: {
      eventItem: true,
    },
  });

  return NextResponse.json({ ok: true, row: serializeAssignment(row) });
}

export async function DELETE(request: Request, context: { params: { sectionId: string } }) {
  await assertAdmin();

  const section = await resolveSectionId(context.params.sectionId.trim());
  if (!section) {
    return NextResponse.json({ ok: false, error: 'section_not_found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const eventItemId = searchParams.get('eventItemId');

  if (!eventItemId) {
    return NextResponse.json({ ok: false, error: 'eventItemId_required' }, { status: 400 });
  }

  await prisma.sectionEventItem.delete({
    where: {
      sectionId_eventItemId: {
        sectionId: section.id,
        eventItemId,
      },
    },
  });

  return NextResponse.json({ ok: true });
}
