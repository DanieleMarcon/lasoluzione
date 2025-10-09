// src/lib/admin/events-dto.ts
import type { EventInstance } from '@prisma/client';

export type AdminEventDTO = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  active: boolean;
  showOnHome: boolean;
  allowEmailOnlyBooking: boolean;
  capacity: number | null;
  createdAt: string;
  updatedAt: string;
};

export function toAdminEventDTO(event: EventInstance): AdminEventDTO {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description ?? null,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt ? event.endAt.toISOString() : null,
    active: event.active,
    showOnHome: event.showOnHome,
    allowEmailOnlyBooking: event.allowEmailOnlyBooking,
    capacity: event.capacity ?? null,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

export function toAdminEventListDTO(events: EventInstance[]): AdminEventDTO[] {
  return events.map(toAdminEventDTO);
}
