"use client";

import Link from 'next/link';
import type { CatalogEventDTO } from '@/types/catalog';

type EventSectionItemProps = {
  event: CatalogEventDTO;
  priceLabel: string;
  onAddToCart?: () => Promise<void> | void;
  disabled?: boolean;
  pending?: boolean;
};

export default function EventSectionItem({
  event,
  priceLabel,
  onAddToCart,
  disabled = false,
  pending = false,
}: EventSectionItemProps) {
  const emailOnly = event.flags.emailOnly;
  const startDate = new Date(event.startAt);
  const startLabel = Number.isNaN(startDate.getTime())
    ? null
    : startDate.toLocaleString('it-IT', { dateStyle: 'short', timeStyle: 'short' });

  const now = new Date();
  const isActive = event.active;
  const isFuture = Number.isNaN(startDate.getTime()) ? false : startDate.getTime() >= now.getTime();
  const hasPrice = typeof event.priceCents === 'number' && event.priceCents > 0;

  const isPurchasable = isActive && !emailOnly && hasPrice && isFuture;
  const canAddToCart = isPurchasable && typeof onAddToCart === 'function';

  return (
    <div className="border rounded-3 p-3 mb-3">
      <div className="d-flex flex-column flex-md-row align-items-start gap-3">
        <div className="flex-grow-1">
          <h5 className="mb-2" style={{ fontSize: '1.1rem' }}>
            {event.title}
          </h5>
          {startLabel ? <div className="text-muted small">{startLabel}</div> : null}
          <div className="text-primary fw-semibold">{priceLabel}</div>
        </div>

        {canAddToCart ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onAddToCart?.()}
            disabled={disabled || pending}
          >
            {pending ? 'Attendere…' : 'Aggiungi al carrello'}
          </button>
        ) : (
          <Link
            href={`/eventi/${encodeURIComponent(event.slug)}`}
            className="btn btn-outline-secondary"
          >
            {/* TODO: valutare CTA alternativa per eventi non acquistabili */}
            Dettagli evento
          </Link>
        )}
      </div>
    </div>
  );
}
