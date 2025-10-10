// src/app/admin/events/page.tsx
import EventsPageClient, { type AdminEvent } from '@/components/admin/events/EventsPageClient';
import { ToastProvider } from '@/components/admin/ui/toast';
import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import type { EventItem } from '@prisma/client';

export const dynamic = 'force-dynamic';

const DEFAULT_PAGE_SIZE = 10;

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
  } satisfies AdminEvent;
}

export default async function AdminEventsPage() {
  await assertAdmin();

  const [total, items] = await Promise.all([
    prisma.eventItem.count(),
    prisma.eventItem.findMany({
      orderBy: { startAt: 'asc' },
      take: DEFAULT_PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));

  const initialEvents: AdminEvent[] = items.map((event) => toAdminEventItemDTO(event));

  return (
    <ToastProvider>
      <EventsPageClient
        initialEvents={initialEvents}
        initialMeta={{
          page: 1,
          pageSize: DEFAULT_PAGE_SIZE,
          total,
          totalPages,
          hasNextPage: total > DEFAULT_PAGE_SIZE,
          hasPreviousPage: false,
        }}
        initialQuery={{ search: '', active: 'all', page: 1 }}
      />
    </ToastProvider>
  );
}
