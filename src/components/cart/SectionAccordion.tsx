"use client";

import { useCallback, useEffect, useMemo, useState } from 'react';

import { useCart } from './CartProvider';

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
  const { addItem, loading: cartLoading } = useCart();
  const [sections, setSections] = useState<CatalogSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [openSection, setOpenSection] = useState<CatalogSectionDTO['key'] | null>(null);
  const [openDetails, setOpenDetails] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let isActive = true;

    const loadSections = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/catalog', { cache: 'no-store' });
        if (!response.ok) {
          throw new Error('Impossibile caricare il catalogo');
        }
        const data = (await response.json()) as CatalogDTO;
        if (!isActive) return;
        const ordered = SECTION_ORDER.map((key) =>
          data.sections.find((section) => section.key === key && section.active),
        ).filter((section): section is CatalogSectionDTO => Boolean(section));

        if (ordered.length > 0) {
          setOpenSection((prev) => prev ?? ordered[0].key);
        }

        setSections(ordered as CatalogSection[]);
      } catch (err) {
        console.error('[SectionAccordion] unable to fetch catalog', err);
        if (!isActive) return;
        setError('Non siamo riusciti a caricare il menu. Riprova più tardi.');
      } finally {
        if (isActive) setLoading(false);
      }
    };

    loadSections();

    return () => {
      isActive = false;
    };
  }, []);

  const handleToggleSection = useCallback((key: CatalogSectionDTO['key']) => {
    setOpenSection((prev) => (prev === key ? null : key));
  }, []);

  const handleToggleDetails = useCallback((productId: number) => {
    setOpenDetails((prev) => ({ ...prev, [productId]: !prev[productId] }));
  }, []);

  const handleAddToCart = useCallback(
    async (productId: number) => {
      await addItem(productId, 1);
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
      return (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      );
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
                const hasDetails = Boolean(
                  (product as CatalogProduct).description ||
                    (product as CatalogProduct).ingredients ||
                    (product as CatalogProduct).allergens,
                );
                const description = (product as CatalogProduct).description;
                const ingredients = (product as CatalogProduct).ingredients;
                const allergens = (product as CatalogProduct).allergens;

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
                              disabled={cartLoading}
                              onClick={() => handleAddToCart(product.id)}
                            >
                              Aggiungi
                            </button>
                          </div>
                        </div>
                        {hasDetails ? (
                          <div
                            className="mt-3"
                            style={{ display: isDetailsOpen ? 'block' : 'none' }}
                            aria-live="polite"
                          >
                            {description ? (
                              <p className="mb-2">
                                <strong>Descrizione:</strong> {description}
                              </p>
                            ) : null}
                            {ingredients ? (
                              <p className="mb-2">
                                <strong>Ingredienti:</strong> {ingredients}
                              </p>
                            ) : null}
                            {allergens ? (
                              <p className="mb-0">
                                <strong>Allergeni:</strong> {allergens}
                              </p>
                            ) : null}
                          </div>
                        ) : null}
                        {!hasDetails ? (
                          <p className="text-muted small mb-0 mt-2">
                            Nessun dettaglio aggiuntivo disponibile.
                          </p>
                        ) : null}
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
  }, [cartLoading, error, handleAddToCart, handleToggleDetails, handleToggleSection, loading, openDetails, openSection, sections]);

  return <div>{content}</div>;
}
