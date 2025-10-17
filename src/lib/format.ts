// src/lib/format.ts

export function formatEuroFromCents(cents: number) {
  const value = (cents ?? 0) / 100;
  return value.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}
