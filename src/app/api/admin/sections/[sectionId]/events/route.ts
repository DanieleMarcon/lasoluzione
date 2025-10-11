import { NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function resolveSectionId(sectionParam: string) {
  const trimmed = sectionParam.trim();
  if (/^\d+$/.test(trimmed)) {
    const numeric = Number.parseInt(trimmed, 10);
    if (Number.isFinite(numeric) && numeric > 0) {
      const section = await prisma.catalogSection.findUnique({ where: { id: numeric } });
      if (section) return section;
    }
  }

  return prisma.catalogSection.findUnique({ where: { key: trimmed } });
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

  let body: unknown;
  try {
    body = await request.json();
  } catch (error) {
    return NextResponse.json({ error: 'payload non valido' }, { status: 400 });
  }

  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'payload non valido' }, { status: 400 });
  }

  const {
    eventId: rawEventId,
    eventItemId: rawEventItemId,
    featured: rawFeatured = false,
    showInHome: rawShowInHome = false,
    displayOrder: rawDisplayOrder,
    order: rawOrder,
  } = body as {
    eventId?: unknown;
    eventItemId?: unknown;
    featured?: unknown;
    showInHome?: unknown;
    displayOrder?: unknown;
    order?: unknown;
  };

  const resolvedEventId =
    typeof rawEventItemId === 'string' && rawEventItemId.trim().length > 0
      ? rawEventItemId.trim()
      : typeof rawEventId === 'string' && rawEventId.trim().length > 0
        ? rawEventId.trim()
        : Number.isFinite(rawEventId as number)
          ? String(rawEventId)
          : null;

  if (!resolvedEventId) {
    return NextResponse.json({ error: 'eventId mancante/non valido' }, { status: 400 });
  }

  if (!(await prisma.eventItem.findUnique({ where: { id: resolvedEventId } }))) {
    return NextResponse.json({ ok: false, error: 'event_not_found' }, { status: 404 });
  }


  const rawDisplayOrderInput = rawDisplayOrder ?? rawOrder ?? 999;

  const displayOrderValue =
    typeof rawDisplayOrderInput === 'number'
      ? rawDisplayOrderInput
      : typeof rawDisplayOrderInput === 'string' && rawDisplayOrderInput.trim().length > 0
        ? Number(rawDisplayOrderInput)
        : Number.NaN;

  const displayOrder = Number.isFinite(displayOrderValue) ? displayOrderValue : 999;
  const featured = typeof rawFeatured === 'boolean' ? rawFeatured : rawFeatured === 'true';
  const showInHome = typeof rawShowInHome === 'boolean' ? rawShowInHome : rawShowInHome === 'true';

  const row = await prisma.sectionEventItem.upsert({
    where: { sectionId_eventId: { sectionId: section.id, eventItemId: resolvedEventId } },
    create: {
      sectionId: section.id,
      eventItemId: resolvedEventId,
      displayOrder,
      featured,
      showInHome,
    },
    update: {
      displayOrder,
      featured,
      showInHome,
    },
    include: { eventItem: true },
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
      sectionId_eventId: {
        sectionId: section.id,
        eventItemId,
      },
    },
  });

  // Post-fix commands:
  // pnpm prisma generate
  // rm -rf .next && pnpm dev

  return NextResponse.json({ ok: true });
}
