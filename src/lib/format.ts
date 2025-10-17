export function formatEuroFromCents(cents: number | null | undefined) {
  const value = (cents ?? 0) / 100;
  return value.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}
