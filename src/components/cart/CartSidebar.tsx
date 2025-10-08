'use client';

import Link from 'next/link';
import { useCallback, useMemo } from 'react';

import { useCart } from '@/hooks/useCart';
import { formatCurrency } from '@/lib/formatCurrency';

export default function CartSidebar() {
  const { cart, loading, error, ready, removeItem, updateItem, pending } = useCart();

  const items = cart?.items ?? [];
  const hasItems = items.length > 0;
  const totalCents = cart?.totalCents ?? 0;

  const subtitle = useMemo(() => {
    if (loading) return 'Caricamento carrello in corso…';
    if (error) return 'Errore nel caricamento del carrello.';
    if (!hasItems) return 'Il carrello è vuoto al momento.';
    return 'Controlla i prodotti selezionati prima di procedere al checkout.';
  }, [loading, error, hasItems]);

  const handleDecrease = useCallback(
    (productId: number, qty: number) => {
      const nextQty = qty - 1;
      if (nextQty <= 0) {
        void removeItem(productId);
      } else {
        void updateItem(productId, nextQty);
      }
    },
    [removeItem, updateItem]
  );

  const handleIncrease = useCallback(
    (productId: number, qty: number) => {
      void updateItem(productId, qty + 1);
    },
    [updateItem]
  );

  const checkoutDisabled = !ready || !hasItems;

  return (
    <aside
      aria-label="Riepilogo carrello"
      style={{
        position: 'sticky',
        top: '6rem',
        border: '1px solid #e2e8f0',
        borderRadius: 16,
        padding: '1.5rem',
        display: 'grid',
        gap: '1.25rem',
        backgroundColor: '#f8fafc',
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>Il tuo carrello</h2>
        <p style={{ margin: '0.5rem 0 0', color: '#475569' }}>{subtitle}</p>
      </div>

      {loading && (
        <div className="text-center py-2" aria-live="polite">
          <div className="spinner-border text-primary" role="status" aria-hidden="true" />
        </div>
      )}

      {error && (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      )}

      {hasItems && (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.75rem' }}>
            {items.map((item) => {
              const isPending = Boolean(pending[item.productId]);
              return (
                <li
                  key={item.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    borderBottom: '1px solid #e2e8f0',
                    paddingBottom: '0.75rem',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                    <div>
                      <strong style={{ display: 'block', color: '#0f172a' }}>{item.nameSnapshot}</strong>
                      <span style={{ color: '#64748b' }}>
                        {item.qty} × {formatCurrency(item.priceCentsSnapshot)}
                      </span>
                    </div>
                    <span style={{ color: '#0f172a', fontWeight: 600 }}>
                      {formatCurrency(item.priceCentsSnapshot * item.qty)}
                    </span>
                  </div>

                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => handleDecrease(item.productId, item.qty)}
                      disabled={loading || isPending}
                    >
                      −
                    </button>
                    <span className="fw-semibold" aria-live="polite">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => handleIncrease(item.productId, item.qty)}
                      disabled={loading || isPending}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className="btn btn-link btn-sm text-danger ms-auto"
                      onClick={() => void removeItem(item.productId)}
                      disabled={loading || isPending}
                    >
                      Rimuovi
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontWeight: 600,
              color: '#0f172a',
            }}
          >
            <span>Totale</span>
            <span>{formatCurrency(totalCents)}</span>
          </div>
        </div>
      )}

      {!loading && !hasItems && !error && (
        <p className="text-muted mb-0">Il carrello è vuoto. Aggiungi un prodotto per iniziare.</p>
      )}

      <Link
        href="/checkout"
        aria-disabled={checkoutDisabled}
        style={{
          pointerEvents: checkoutDisabled ? 'none' : 'auto',
          opacity: checkoutDisabled ? 0.6 : 1,
          textAlign: 'center',
          padding: '0.75rem 1.25rem',
          borderRadius: 999,
          fontWeight: 600,
          backgroundColor: '#2563eb',
          color: '#fff',
          textDecoration: 'none',
          transition: 'background-color 0.2s ease',
        }}
      >
        Vai al checkout
      </Link>
    </aside>
  );
}
