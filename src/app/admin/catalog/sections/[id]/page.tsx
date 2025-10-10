import { notFound, redirect } from 'next/navigation';

import { ToastProvider } from '@/components/admin/ui/toast';
import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';

import SectionEventsClient, { type SectionEventAssignment } from './section-events-client';

export const dynamic = 'force-dynamic';

export default async function AdminSectionDetailPage({ params }: { params: { id: string } }) {
  await assertAdmin();

  const key = params.id.trim();
  if (!key) {
    notFound();
  }

  const section = await prisma.catalogSection.findUnique({ where: { key } });
  if (!section) {
    notFound();
  }

  if (section.key !== 'eventi') {
    redirect('/admin/catalog/sections');
  }

  const assignments = await prisma.sectionEvent.findMany({
    where: { sectionId: section.key },
    orderBy: [{ order: 'asc' }, { eventId: 'asc' }],
  });

  const eventIds = assignments.map((assignment) => assignment.eventId);
  const events = eventIds.length
    ? await prisma.eventItem.findMany({ where: { id: { in: eventIds } } })
    : [];

  const eventMap = new Map(events.map((event) => [event.id, event]));

  const initialAssignments: SectionEventAssignment[] = assignments
    .map((assignment) => {
      const event = eventMap.get(assignment.eventId);
      if (!event) return null;
      return {
        eventId: assignment.eventId,
        order: assignment.order,
        featured: assignment.featured,
        showInHome: assignment.showInHome,
        title: event.title,
        slug: event.slug,
        startAt: event.startAt.toISOString(),
        endAt: event.endAt ? event.endAt.toISOString() : null,
        priceCents: event.priceCents,
        emailOnly: event.emailOnly,
        active: event.active,
      };
    })
    .filter((assignment): assignment is SectionEventAssignment => assignment != null);

  return (
    <ToastProvider>
      <SectionEventsClient
        sectionKey={section.key}
        sectionTitle={section.title}
        initialAssignments={initialAssignments}
      />
    </ToastProvider>
  );
}
