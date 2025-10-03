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
  };
}
