import type { Booking, CartItem } from '@prisma/client';

export type BookingForAdminDTO = Booking & {
  order?: { cart?: { items?: CartItem[] } | null } | null;
};

function sumCartCents(items: CartItem[] = []): number {
  return items.reduce((s, it) => {
    const q = typeof it.qty === 'number' ? it.qty : 0;
    const p = typeof it.priceCentsSnapshot === 'number' ? it.priceCentsSnapshot : 0;
    return s + q * p;
  }, 0);
}

function itemsSummary(items: CartItem[] = []): string {
  return items.map(it => `${it.nameSnapshot} × ${it.qty}`).join(', ');
}

// mantieni questo nome export
export function toAdminBookingDTO(b: BookingForAdminDTO) {
  const isEvent = b.type === 'event'; // NON usare altre proprietà
  const items = b.order?.cart?.items ?? [];

  return {
    ...b, // non rimuovere campi esistenti
    display: {
      typeLabel: isEvent ? 'evento' : String(b.type),
      totalCents: sumCartCents(items),
      itemsSummary: itemsSummary(items),
    },
  };
}
