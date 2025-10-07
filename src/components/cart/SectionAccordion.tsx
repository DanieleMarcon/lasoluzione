/* eslint-disable @next/next/no-img-element */
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useCart } from '@/hooks/useCart';

import type { CatalogDTO, CatalogSectionDTO } from '@/types/catalog';

type CatalogProduct = CatalogSectionDTO['products'][number] & {
  description?: string | null;
  ingredients?: string | null;
  allergens?: string | null;
};

type CatalogSection = Omit<CatalogSectionDTO, 'products'> & {
  products: CatalogProduct[];
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
  // dall’hook del carrello
  const { cartToken, loading: cartLoading, refresh } = useCart();

  const [sections, setSections] = useState<CatalogSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<CatalogSectionDTO['key'] | null>(null);
  const [openDetails, setOpenDetails] = useState<Record<number, boolean>>({});
  const [pending, setPending] = useState<Record<number, boolean>>({}); // stato per i bottoni “Aggiungi”

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
      // assicurati di avere un token
      let token = cartToken;
      if (!token) {
        const created = await refresh(); // l’hook, con token null, crea il carrello
        token = created?.token ?? null;
      }
      if (!token) return;

      try {
        setPending((m) => ({ ...m, [p.id]: true }));

        const res = await fetch(`/api/cart/${encodeURIComponent(token)}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            productId: p.id,
            qty: 1,
            nameSnapshot: p.name,
            priceCentsSnapshot: p.priceCents,       // <-- fondamentale per il totale
            imageUrlSnapshot: p.imageUrl ?? undefined,
            // meta: puoi passare un oggetto opzionale se servono dettagli aggiuntivi
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({} as any));
          throw new Error(body?.error || `HTTP ${res.status}`);
        }

        // aggiorna lo stato del carrello (totale, righe, ecc.)
        await refresh();
      } catch (e) {
        console.error('[SectionAccordion] add item error', e);
        // opzionale: toast d’errore
      } finally {
        setPending((m) => ({ ...m, [p.id]: false }));
      }
    },
    [cartToken, refresh]
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
              <p className="text-muted">Nessun prodotto disponibile in questa sezione.</p>
            ) : (
              section.products.map((product) => {
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
                              disabled={cartLoading || !!pending[product.id]}
                              onClick={() => handleAddToCart(product)}
                            >
                              {pending[product.id] ? 'Attendere…' : 'Aggiungi'}
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
    handleAddToCart,
    handleToggleDetails,
    handleToggleSection,
  ]);

  return <div>{content}</div>;
}
