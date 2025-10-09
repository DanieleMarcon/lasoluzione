// src/lib/admin/event-instances.ts
import { prisma } from '@/lib/prisma';
import type { AdminEventInstance } from '@/types/admin';

export async function fetchAdminEventInstances(): Promise<AdminEventInstance[]> {
  const instances = await prisma.eventInstance.findMany({
    orderBy: { startAt: 'asc' },
    select: {
      id: true,
      title: true,
      slug: true,
      startAt: true,
      allowEmailOnlyBooking: true,
      active: true,
    },
  });

  return instances.map((instance) => ({
    id: instance.id,
    title: instance.title,
    slug: instance.slug,
    startAt: instance.startAt.toISOString(),
    allowEmailOnlyBooking: instance.allowEmailOnlyBooking,
    active: instance.active,
  }));
}
