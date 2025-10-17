// src/lib/admin/booking-dto.ts
import type { Booking } from '@prisma/client';

import { normalizeStoredDinnerItems, normalizeStoredLunchItems } from '@/lib/lunchOrder';

type BookingWithRelations = Booking & {
  order?: {
    cart?: {
      totalCents?: number | null;
      items?: {
        priceCentsSnapshot: number | null;
        qty: number | null;
        nameSnapshot: string | null;
      }[];
    } | null;
  } | null;
  eventInstanceId?: number | null;
  eventInstance?: {
    title: string | null;
    product?: {
      name: string | null;
    } | null;
  } | null;
};

function getEventInstanceId(booking: BookingWithRelations): number | null {
  const raw = (booking as { eventInstanceId?: unknown }).eventInstanceId;
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : null;
}

function computeCartTotalCents(booking: BookingWithRelations): number | null {
  const cart = booking.order?.cart;
  if (!cart) return null;
  const items = Array.isArray(cart.items) ? cart.items : [];
  if (items.length > 0) {
    const total = items.reduce((sum, item) => {
      const price = typeof item?.priceCentsSnapshot === 'number' ? item.priceCentsSnapshot : 0;
      const qty = typeof item?.qty === 'number' ? item.qty : 0;
      return sum + price * qty;
    }, 0);
    if (total > 0) {
      return total;
    }
  }
  const cartTotal = cart.totalCents;
  if (typeof cartTotal === 'number' && Number.isFinite(cartTotal) && cartTotal > 0) {
    return cartTotal;
  }
  return null;
}

function computeTierTotalCents(booking: BookingWithRelations): number | null {
  const price = booking.tierPriceCents;
  if (typeof price !== 'number' || !Number.isFinite(price) || price <= 0) {
    return null;
  }
  const people = typeof booking.people === 'number' && Number.isFinite(booking.people) ? booking.people : 0;
  return people > 0 ? price * people : null;
}

function sumOrderItems(items: ReturnType<typeof normalizeStoredLunchItems>): number {
  return items.reduce((sum, item) => {
    const price = typeof item?.priceCents === 'number' ? item.priceCents : 0;
    const qty = typeof item?.qty === 'number' ? item.qty : 0;
    if (!Number.isFinite(price) || !Number.isFinite(qty)) return sum;
    return sum + price * qty;
  }, 0);
}

function computeLegacyTotalCents(booking: BookingWithRelations): number | null {
  const candidates = [booking.totalCents, booking.dinnerTotalCents, booking.subtotalCents, booking.dinnerSubtotalCents];
  for (const value of candidates) {
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  const lunchItems = normalizeStoredLunchItems((booking as any).lunchItemsJson);
  if (lunchItems.length > 0) {
    const subtotal = sumOrderItems(lunchItems);
    if (subtotal > 0) {
      const cover = typeof booking.coverCents === 'number' ? booking.coverCents : 0;
      const people = typeof booking.people === 'number' && Number.isFinite(booking.people) ? booking.people : 0;
      return subtotal + Math.max(0, cover) * Math.max(0, people);
    }
  }

  const dinnerItems = normalizeStoredDinnerItems((booking as any).dinnerItemsJson);
  if (dinnerItems.length > 0) {
    const subtotal = sumOrderItems(dinnerItems);
    if (subtotal > 0) {
      const cover = typeof booking.dinnerCoverCents === 'number' ? booking.dinnerCoverCents : 0;
      const people = typeof booking.people === 'number' && Number.isFinite(booking.people) ? booking.people : 0;
      return subtotal + Math.max(0, cover) * Math.max(0, people);
    }
  }

  return null;
}

function computeDisplayTotalCents(booking: BookingWithRelations): number {
  return (
    computeCartTotalCents(booking) ??
    computeTierTotalCents(booking) ??
    computeLegacyTotalCents(booking) ??
    0
  );
}

function formatLegacyItemsSummary(items: ReturnType<typeof normalizeStoredLunchItems>): string {
  if (!items || items.length === 0) return '';
  const parts = items.slice(0, 3).map((item) => {
    const name = typeof item?.name === 'string' ? item.name.trim() : '';
    if (!name) return '';
    const qty = typeof item?.qty === 'number' && Number.isFinite(item.qty) ? item.qty : 0;
    return qty > 1 ? `${qty}× ${name}` : name;
  });
  const filtered = parts.filter((part) => part.length > 0);
  if (filtered.length === 0) return '';
  const label = filtered.join(', ');
  return items.length > filtered.length ? `${label}…` : label;
}

function computeEventSummary(booking: BookingWithRelations): string {
  const candidates = [
    booking.eventInstance?.title,
    booking.eventInstance?.product?.name,
    booking.tierLabel,
  ];
  const normalizedTitle = candidates
    .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
    .find((entry) => entry.length > 0);
  const tierLabel = typeof booking.tierLabel === 'string' ? booking.tierLabel.trim() : '';
  const title = normalizedTitle && normalizedTitle.length > 0 ? normalizedTitle : 'Evento';
  const parts = [title];
  if (tierLabel && !parts.some((part) => part.localeCompare(tierLabel, undefined, { sensitivity: 'accent' }) === 0)) {
    parts.push(tierLabel);
  }
  const base = parts.join(' – ');
  const people = typeof booking.people === 'number' && Number.isFinite(booking.people) ? booking.people : 0;
  return people > 0 ? `${base} × ${people}` : base;
}

function computeItemsSummary(booking: BookingWithRelations, typeLabel: string): string {
  if (typeLabel === 'evento' || booking.type === 'evento') {
    return computeEventSummary(booking);
  }

  if (typeLabel === 'pranzo' || booking.type === 'pranzo') {
    const lunchItems = normalizeStoredLunchItems((booking as any).lunchItemsJson);
    const summary = formatLegacyItemsSummary(lunchItems);
    if (summary) return summary;
  }

  if (typeLabel === 'cena' || booking.type === 'cena') {
    const dinnerItems = normalizeStoredDinnerItems((booking as any).dinnerItemsJson);
    const summary = formatLegacyItemsSummary(dinnerItems);
    if (summary) return summary;
  }

  const lunchItems = normalizeStoredLunchItems((booking as any).lunchItemsJson);
  if (lunchItems.length > 0) {
    const summary = formatLegacyItemsSummary(lunchItems);
    if (summary) return summary;
  }

  const dinnerItems = normalizeStoredDinnerItems((booking as any).dinnerItemsJson);
  if (dinnerItems.length > 0) {
    const summary = formatLegacyItemsSummary(dinnerItems);
    if (summary) return summary;
  }

  return '';
}

export function toAdminBookingDTO(booking: BookingWithRelations) {
  const eventInstanceId = getEventInstanceId(booking);
  const displayTypeLabel = eventInstanceId ? 'evento' : booking.type;
  const displayTotalCents = computeDisplayTotalCents(booking);
  const displayItemsSummary = computeItemsSummary(booking, displayTypeLabel);

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
    agreePrivacy: booking.agreePrivacy === true,
    agreeMarketing: booking.agreeMarketing === true,
    display: {
      typeLabel: displayTypeLabel,
      totalCents: displayTotalCents,
      itemsSummary: displayItemsSummary,
    },
  };
}
