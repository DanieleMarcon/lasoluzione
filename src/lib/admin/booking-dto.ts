// src/lib/admin/booking-dto.ts
import type { Booking, CartItem } from '@prisma/client';

export type BookingForAdminDTO = Booking & {
  order?: { cart?: { items?: CartItem[] | null } | null } | null;
};

// Helper: somma in centesimi usando SOLO qty/priceCentsSnapshot
function sumCartCents(items: CartItem[] = []): number {
  return items.reduce((sum, it) => {
    const q = typeof it.qty === 'number' ? it.qty : 0;
    const p = typeof it.priceCentsSnapshot === 'number' ? it.priceCentsSnapshot : 0;
    return sum + q * p;
  }, 0);
}

// Helper: dettaglio compatto "Nome × qty"
function itemsSummary(items: CartItem[] = []): string {
  const parts = items
    .map((it) => {
      const name = typeof it.nameSnapshot === 'string' ? it.nameSnapshot : '';
      const qty = typeof it.qty === 'number' ? it.qty : 0;
      if (!name) return '';
      return `${name} × ${qty}`;
    })
    .filter((part): part is string => part.length > 0);
  return parts.join(', ');
}

export function toAdminBookingDTO(booking: BookingForAdminDTO) {
  const isEvent = !!booking.eventInstanceId;
  const items = booking.order?.cart?.items ?? [];
  const totalCents = sumCartCents(items);
  const summary = itemsSummary(items);

  return {
    ...booking, // non rimuovere campi esistenti
    date: booking.date instanceof Date ? booking.date.toISOString() : String(booking.date),
    createdAt:
      booking.createdAt instanceof Date ? booking.createdAt.toISOString() : String(booking.createdAt),
    updatedAt:
      booking.updatedAt instanceof Date ? booking.updatedAt.toISOString() : String(booking.updatedAt),
    display: {
      typeLabel: isEvent ? 'evento' : (booking.type as unknown as string),
      totalCents,
      itemsSummary: summary,
    },
  };
}
