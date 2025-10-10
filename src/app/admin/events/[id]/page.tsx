// src/app/admin/events/[id]/page.tsx
import EventDetailPageClient from '@/components/admin/events/EventDetailPageClient';
import { ToastProvider } from '@/components/admin/ui/toast';
import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

function formatTier(product: { id: number; name: string; description: string | null; priceCents: number; order: number; active: boolean }) {
  return {
    id: product.id,
    label: product.name,
    description: product.description ?? null,
    priceCents: product.priceCents,
    order: product.order,
    active: product.active,
  };
}

export default async function AdminEventDetailPage({ params }: { params: { id: string } }) {
  await assertAdmin();

  const eventId = Number.parseInt(params.id, 10);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    notFound();
  }

  const event = await prisma.eventInstance.findUnique({ where: { id: eventId } });
  if (!event) {
    notFound();
  }

  const tiers = await prisma.product.findMany({
    where: {
      sourceType: 'event_instance_tier',
      sourceId: String(eventId),
    },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  });

  const eventDto = {
    id: event.id,
    title: event.title,
    slug: event.slug,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt ? event.endAt.toISOString() : null,
    active: event.active,
    showOnHome: event.showOnHome,
    allowEmailOnlyBooking: event.allowEmailOnlyBooking,
  };

  return (
    <ToastProvider>
      <EventDetailPageClient event={eventDto} initialTiers={tiers.map(formatTier)} />
    </ToastProvider>
  );
}
