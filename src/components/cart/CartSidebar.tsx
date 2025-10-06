'use client';

import Link from 'next/link';
import { useMemo } from 'react';

import { useCart } from '@/hooks/useCart';
import { formatCurrency } from '@/lib/formatCurrency';

export default function CartSidebar() {
  const { cart, loading, error } = useCart();

  const items = cart?.items ?? [];
  const total = cart?.totalCents ?? 0;

  const hasItems = items.length > 0;

  const subtitle = useMemo(() => {
    if (loading) return 'Caricamento carrello...';
    if (error) return 'Errore nel caricamento del carrello.';
    if (!hasItems) return 'Il carrello è vuoto al momento.';
    return undefined;
  }, [loading, error, hasItems]);

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
        gap: '1rem',
        backgroundColor: '#f8fafc',
      }}
    >
      <div>
        <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#0f172a' }}>Il tuo ordine</h2>
        {subtitle ? (
          <p style={{ margin: '0.5rem 0 0', color: '#475569' }}>{subtitle}</p>
        ) : (
          <p style={{ margin: '0.5rem 0 0', color: '#475569' }}>
            Controlla i prodotti selezionati prima di completare il checkout.
          </p>
        )}
      </div>

      {hasItems && (
        <div style={{ display: 'grid', gap: '0.75rem' }}>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.75rem' }}>
            {items.map((item) => (
              <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                <div>
                  <strong style={{ display: 'block', color: '#0f172a' }}>{item.nameSnapshot}</strong>
                  <span style={{ color: '#64748b' }}>x {item.qty}</span>
                </div>
                <span style={{ color: '#0f172a', fontWeight: 600 }}>
                  {formatCurrency(item.priceCentsSnapshot * item.qty)}
                </span>
              </li>
            ))}
          </ul>
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              fontWeight: 600,
              color: '#0f172a',
              borderTop: '1px solid #e2e8f0',
              paddingTop: '0.75rem',
            }}
          >
            <span>Totale</span>
            <span>{formatCurrency(total)}</span>
          </div>
        </div>
      )}

      <Link
        href="/checkout"
        aria-disabled={!hasItems}
        style={{
          pointerEvents: hasItems ? 'auto' : 'none',
          opacity: hasItems ? 1 : 0.6,
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
