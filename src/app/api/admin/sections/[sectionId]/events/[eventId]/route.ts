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

export async function DELETE(request: Request, context: { params: { sectionId: string; eventId: string } }) {
  await assertAdmin();

  const section = await resolveSectionId(context.params.sectionId.trim());
  if (!section) {
    return NextResponse.json({ ok: false, error: 'section_not_found' }, { status: 404 });
  }

  const eventItemId = context.params.eventId;
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
