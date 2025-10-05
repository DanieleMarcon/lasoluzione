// src/lib/admin/booking-dto.ts
import type { Booking } from '@prisma/client';

export function toAdminBookingDTO(booking: Booking) {
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
  };
}
