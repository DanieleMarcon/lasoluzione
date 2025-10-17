// src/lib/format.ts
export function formatEuroFromCents(cents: number | null | undefined) {
  const safeCents = typeof cents === 'number' && Number.isFinite(cents) ? cents : 0;
  return (safeCents / 100).toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
  });
}
