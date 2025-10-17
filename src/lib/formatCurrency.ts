// src/lib/formatCurrency.ts
import { formatEuroFromCents } from '@/lib/format';

export function formatCurrency(cents: number) {
  return formatEuroFromCents(cents);
}
