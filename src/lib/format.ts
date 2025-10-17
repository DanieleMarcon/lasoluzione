export function formatEuroFromCents(cents: number) {
  const v = (cents ?? 0) / 100;
  return v.toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });
}
