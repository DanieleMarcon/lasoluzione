// src/app/admin/events/page.tsx
import EventsPageClient from '@/components/admin/events/EventsPageClient';
import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import { toAdminEventDTO } from '@/lib/admin/events-dto';

export const dynamic = 'force-dynamic';

const DEFAULT_PAGE_SIZE = 10;

export default async function AdminEventsPage() {
  await assertAdmin();

  const [total, items] = await Promise.all([
    prisma.eventInstance.count(),
    prisma.eventInstance.findMany({
      orderBy: { startAt: 'asc' },
      take: DEFAULT_PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / DEFAULT_PAGE_SIZE));

  return (
    <EventsPageClient
      initialEvents={items.map(toAdminEventDTO)}
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
  );
}
