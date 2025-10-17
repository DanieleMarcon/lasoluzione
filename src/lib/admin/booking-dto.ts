// src/lib/admin/booking-dto.ts
import type { Prisma } from '@prisma/client';

type BookingWithOrder = Prisma.BookingGetPayload<{
  include: {
    order: {
      include: {
        cart: {
          include: {
            items: true;
          };
        };
      };
    };
  };
}>;

function getLegacyTypeLabel(type: string | null) {
  return type ?? '';
}

export function toAdminBookingDTO(booking: BookingWithOrder) {
  const isEvent = Boolean(booking.eventInstanceId);
  const typeLabel = isEvent ? 'evento' : getLegacyTypeLabel(booking.type);

  const items = booking.order?.cart?.items ?? [];
  const totalCents = items.reduce((sum, item) => {
    const quantity = item.qty ?? 0;
    const priceCents = item.priceCentsSnapshot ?? 0;
    return sum + quantity * priceCents;
  }, 0);

  const itemsSummary = items
    .map((item) => `${item.nameSnapshot} × ${item.qty ?? 0}`)
    .join(', ');

  return {
    id: booking.id,
    date: booking.date.toISOString(),
    people: booking.people,
    type: booking.type,
    name: booking.name,
    email: booking.email,
    phone: booking.phone,
    notes: booking.notes,
    status: booking.status,
    createdAt: booking.createdAt.toISOString(),
    updatedAt: booking.updatedAt.toISOString(),
    tierLabel: booking.tierLabel,
    tierPriceCents: booking.tierPriceCents,
    tierType: booking.tierType,
    subtotalCents: booking.subtotalCents,
    coverCents: booking.coverCents,
    totalCents: booking.totalCents,
    dinnerSubtotalCents: booking.dinnerSubtotalCents ?? null,
    dinnerCoverCents: booking.dinnerCoverCents ?? null,
    dinnerTotalCents: booking.dinnerTotalCents ?? null,
    agreePrivacy: booking.agreePrivacy === true,
    agreeMarketing: booking.agreeMarketing === true,
    display: {
      typeLabel,
      totalCents,
      itemsSummary,
    },
  };
}
