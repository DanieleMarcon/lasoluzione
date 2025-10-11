/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { pendingKeyForEvent, pendingKeyForProduct, useCart } from '@/hooks/useCart';

import EventSectionItem from './EventSectionItem';
import type {
  CatalogDTO,
  CatalogEventDTO,
  CatalogProductDTO,
  CatalogSectionDTO,
} from '@/types/catalog';

type CatalogProduct = CatalogProductDTO & {
  description?: string | null;
  ingredients?: string | null;
  allergens?: string | null;
};

type CatalogEvent = CatalogEventDTO;

type CatalogSection = Omit<CatalogSectionDTO, 'products'> & {
  products: Array<CatalogProduct | CatalogEvent>;
};

const SECTION_ORDER: CatalogSectionDTO['key'][] = [
  'eventi',
  'aperitivo',
  'pranzo',
  'cena',
  'colazione',
];

const currencyFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
});

export default function SectionAccordion() {
  const { loading: cartLoading, addItem, pending } = useCart();

  const [sections, setSections] = useState<CatalogSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<CatalogSectionDTO['key'] | null>(null);
  const [openDetails, setOpenDetails] = useState<Record<number, boolean>>({});
  const [localPending, setLocalPending] = useState<Record<string, boolean>>({});

  // Carica il catalogo
  useEffect(() => {
    let alive = true;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/catalog', { cache: 'no-store' });
        if (!res.ok) throw new Error('Impossibile caricare il catalogo');
        const data = (await res.json()) as CatalogDTO;

        if (!alive) return;

        const ordered = SECTION_ORDER
          .map((k) => data.sections.find((s) => s.key === k && s.active))
          .filter((s): s is CatalogSectionDTO => Boolean(s));

        if (ordered.length > 0) setOpenSection((prev) => prev ?? ordered[0].key);

        setSections(ordered as CatalogSection[]);
      } catch (e) {
        console.error('[SectionAccordion] fetch catalog error', e);
        if (alive) setError('Non siamo riusciti a caricare il menu. Riprova più tardi.');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, []);

  const handleToggleSection = useCallback((key: CatalogSectionDTO['key']) => {
    setOpenSection((prev) => (prev === key ? null : key));
  }, []);

  const handleToggleDetails = useCallback((productId: number) => {
    setOpenDetails((prev) => ({ ...prev, [productId]: !prev[productId] }));
  }, []);

  /**
   * Aggiunge al carrello:
   * - se non c’è ancora un token, lo crea via refresh()
   * - invia anche gli snapshot (name/price/img) così il totale risulta corretto
   * - poi rifresha il carrello per aggiornare il totale nella UI
   */
  const handleAddToCart = useCallback(
    async (p: CatalogProduct) => {
      const pendingKey = pendingKeyForProduct(p.id);
      try {
        setLocalPending((m) => ({ ...m, [pendingKey]: true }));
        await addItem({
          kind: 'product',
          productId: p.id,
          qty: 1,
          nameSnapshot: p.name,
          priceCentsSnapshot: p.priceCents,
          imageUrlSnapshot: p.imageUrl ?? undefined,
        });
      } catch (e) {
        console.error('[SectionAccordion] add item error', e);
      } finally {
        setLocalPending((m) => {
          const next = { ...m };
          delete next[pendingKey];
          return next;
        });
      }
    },
    [addItem]
  );

  const handleAddEventToCart = useCallback(
    async (event: CatalogEvent) => {
      const pendingKey = pendingKeyForEvent(event.id);
      try {
        setLocalPending((m) => ({ ...m, [pendingKey]: true }));
        await addItem({
          kind: 'event',
          eventItemId: event.id,
          title: event.title,
          priceCents: event.priceCents,
          quantity: 1,
        });
      } catch (e) {
        console.error('[SectionAccordion] add event error', e);
      } finally {
        setLocalPending((m) => {
          const next = { ...m };
          delete next[pendingKey];
          return next;
        });
      }
    },
    [addItem],
  );

  const content = useMemo(() => {
    if (loading) {
      return (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" aria-hidden="true" />
          <p className="mt-3 mb-0">Caricamento menu…</p>
        </div>
      );
    }

    if (error) {
      return <div className="alert alert-danger">{error}</div>;
    }

    if (sections.length === 0) {
      return <p className="text-muted">Il menu non è al momento disponibile.</p>;
    }

    return sections.map((section) => (
      <div className="card mb-3" key={section.key}>
        <button
          type="button"
          className="btn btn-link text-start text-decoration-none"
          onClick={() => handleToggleSection(section.key)}
          aria-expanded={openSection === section.key}
          style={{ padding: '1.25rem', fontSize: '1.1rem', fontWeight: 600 }}
        >
          <div className="d-flex justify-content-between align-items-center">
            <span>{section.title}</span>
            <span className="ms-3 text-muted" aria-hidden="true" style={{ fontSize: '1.25rem' }}>
              {openSection === section.key ? '−' : '+'}
            </span>
          </div>
          {section.description ? (
            <small className="text-muted d-block mt-2">{section.description}</small>
          ) : null}
        </button>

        {openSection === section.key ? (
          <div className="px-4 pb-4">
            {section.products.length === 0 ? (
              <p className="text-muted">
                {section.key === 'eventi'
                  ? 'Nessun evento disponibile in questa sezione.'
                  : 'Il menu non è al momento disponibile.'}
              </p>
            ) : section.key === 'eventi' ? (
              section.products
                .filter((item): item is CatalogEvent => item.type === 'event')
                .map((event) => {
                  const eventPendingKey = pendingKeyForEvent(event.id);
                  const pendingStatus = Boolean(
                    pending[eventPendingKey] || localPending[eventPendingKey]
                  );

                  return (
                    <EventSectionItem
                      key={`event-${event.id}`}
                      event={event}
                      priceLabel={currencyFormatter.format(event.priceCents / 100)}
                      pending={pendingStatus}
                      disabled={cartLoading}
                      onAddToCart={() => handleAddEventToCart(event)}
                    />
                  );
                })
            ) : (
              section.products
                .filter((item): item is CatalogProduct => item.type === 'product')
                .map((product) => {
                  const isDetailsOpen = openDetails[product.id] ?? false;
                  const hasDetails =
                    Boolean(product.description) ||
                    Boolean(product.ingredients) ||
                    Boolean(product.allergens);

                  return (
                    <div className="border rounded-3 p-3 mb-3" key={product.id}>
                      <div className="d-flex align-items-start">
                        {product.imageUrl ? (
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            className="rounded me-3"
                            style={{ width: 72, height: 72, objectFit: 'cover' }}
                          />
                        ) : null}

                        <div className="flex-grow-1">
                          <div className="d-flex justify-content-between align-items-start flex-wrap gap-2">
                            <div>
                              <h5 className="mb-1" style={{ fontSize: '1.05rem' }}>
                                {product.name}
                              </h5>
                              <span className="text-primary fw-semibold">
                                {currencyFormatter.format(product.priceCents / 100)}
                              </span>
                            </div>

                            <div className="d-flex gap-2">
                              {hasDetails ? (
                                <button
                                  type="button"
                                  className="btn btn-outline-secondary btn-sm"
                                  onClick={() => handleToggleDetails(product.id)}
                                >
                                  {isDetailsOpen ? 'Nascondi dettagli' : 'Dettagli'}
                                </button>
                              ) : null}

                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                disabled={
                                  cartLoading || !!pending[product.id] || !!localPending[product.id]
                                }
                                onClick={() => handleAddToCart(product)}
                              >
                                {pending[product.id] || localPending[product.id]
                                  ? 'Attendere…'
                                  : 'Aggiungi'}
                              </button>
                            </div>
                          </div>

                          {hasDetails ? (
                            <div
                              className="mt-3"
                              style={{ display: isDetailsOpen ? 'block' : 'none' }}
                              aria-live="polite"
                            >
                              {product.description ? (
                                <p className="mb-2">
                                  <strong>Descrizione:</strong> {product.description}
                                </p>
                              ) : null}
                              {product.ingredients ? (
                                <p className="mb-2">
                                  <strong>Ingredienti:</strong> {product.ingredients}
                                </p>
                              ) : null}
                              {product.allergens ? (
                                <p className="mb-0">
                                  <strong>Allergeni:</strong> {product.allergens}
                                </p>
                              ) : null}
                            </div>
                          ) : (
                            <p className="text-muted small mb-0 mt-2">
                              Nessun dettaglio aggiuntivo disponibile.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
            )}
          </div>
        ) : null}
      </div>
    ));
  }, [
    loading,
    error,
    sections,
    openSection,
    openDetails,
    cartLoading,
    pending,
    localPending,
    handleAddToCart,
    handleAddEventToCart,
    handleToggleDetails,
    handleToggleSection,
  ]);

  return <div>{content}</div>;
}
