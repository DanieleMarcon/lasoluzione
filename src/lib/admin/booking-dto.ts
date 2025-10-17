// src/lib/admin/booking-dto.ts
import type { Booking, CartItem } from '@prisma/client';

export type BookingForAdminDTO = Booking & {
  order?: {
    cart?: {
      items?: CartItem[];
    } | null;
  } | null;
};

export function toAdminBookingDTO(booking: BookingForAdminDTO) {
  const eventInstanceId = (booking as { eventInstanceId?: unknown }).eventInstanceId;
  const isEvent = eventInstanceId != null;
  const typeLabel = isEvent ? 'evento' : (booking.type as unknown as string);

  const items = booking.order?.cart?.items ?? [];
  const totalCents = items.reduce((sum, item) => {
    const quantity = item.qty ?? item.quantity ?? 0;
    const price = item.priceCentsSnapshot ?? item.priceCents ?? 0;
    return sum + quantity * price;
  }, 0);

  const parts = items.reduce<string[]>((acc, item) => {
    const name = item.nameSnapshot ?? item.name ?? '';
    const quantity = item.qty ?? item.quantity ?? 0;
    if (!name && quantity === 0) {
      return acc;
    }
    acc.push(`${name} × ${quantity}`);
    return acc;
  }, []);
  const itemsSummary = parts.join(', ');

  return {
    ...booking,
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
