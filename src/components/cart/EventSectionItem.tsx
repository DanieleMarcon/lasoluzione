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

  const canAddToCart = !emailOnly && typeof onAddToCart === 'function';

  return (
    <div className="border rounded-3 p-3 mb-3">
      <div className="d-flex flex-column flex-md-row align-items-start gap-3">
        <div className="flex-grow-1">
          <h5 className="mb-2" style={{ fontSize: '1.1rem' }}>
            {event.title}
          </h5>
          <div className="text-primary fw-semibold">{priceLabel}</div>
        </div>

        {emailOnly ? (
          <Link
            href={`/eventi/${encodeURIComponent(event.slug)}`}
            className="btn btn-outline-primary"
          >
            Prenota via email
          </Link>
        ) : canAddToCart ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onAddToCart?.()}
            disabled={disabled || pending || !onAddToCart}
          >
            {pending ? 'Attendere…' : 'Aggiungi al carrello'}
          </button>
        ) : (
          <Link
            href={`/eventi/${encodeURIComponent(event.slug)}`}
            className="btn btn-outline-secondary"
          >
            Dettagli evento
          </Link>
        )}
      </div>
    </div>
  );
}
