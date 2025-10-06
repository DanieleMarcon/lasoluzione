// src/app/prenota/page.tsx
"use client";

import BookingWizard from '@/components/booking/BookingWizard';
import CartProvider, { useCart } from '@/components/cart/CartProvider';
import SectionAccordion from '@/components/cart/SectionAccordion';
import type { CartDTO } from '@/types/cart';

const CART_ENABLED = process.env.NEXT_PUBLIC_CART_ENABLED === 'true';

const moneyFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
});

type CartItem = CartDTO['items'][number];

function CartSidebar() {
  const { cart, loading, updateItem, removeItem } = useCart();
  const items = cart?.items ?? [];
  const totalCents = cart?.totalCents ?? 0;

  const handleDecrease = (item: CartItem) => {
    const nextQty = item.qty - 1;
    if (nextQty <= 0) {
      void removeItem(item.id);
    } else {
      void updateItem(item.id, nextQty);
    }
  };

  const handleIncrease = (item: CartItem) => {
    void updateItem(item.id, item.qty + 1);
  };

  return (
    <aside className="card shadow-sm" style={{ position: 'sticky', top: '1rem' }}>
      <div className="card-body">
        <h2 className="h5 mb-3">Il tuo carrello</h2>

        {items.length === 0 && !loading ? (
          <p className="text-muted mb-0">Il carrello è vuoto. Aggiungi un prodotto per iniziare.</p>
        ) : null}

        {items.length > 0 ? (
          <ul className="list-unstyled mb-0">
            {items.map((item) => (
              <li key={item.id} className="mb-3 pb-3 border-bottom">
                <div className="d-flex justify-content-between align-items-start gap-3">
                  <div>
                    <div className="fw-semibold">{item.nameSnapshot}</div>
                    <small className="text-muted">
                      {moneyFormatter.format(item.priceCentsSnapshot / 100)} cad.
                    </small>
                  </div>
                  <div className="d-flex align-items-center gap-2">
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => handleDecrease(item)}
                      disabled={loading}
                    >
                      −
                    </button>
                    <span className="fw-semibold" aria-live="polite">
                      {item.qty}
                    </span>
                    <button
                      type="button"
                      className="btn btn-outline-secondary btn-sm"
                      onClick={() => handleIncrease(item)}
                      disabled={loading}
                    >
                      +
                    </button>
                  </div>
                </div>
                <div className="d-flex justify-content-between align-items-center mt-2">
                  <small className="text-muted">Totale</small>
                  <strong>{moneyFormatter.format((item.priceCentsSnapshot * item.qty) / 100)}</strong>
                </div>
              </li>
            ))}
          </ul>
        ) : null}

        {loading ? (
          <div className="text-center py-3" aria-live="polite">
            <div className="spinner-border text-primary" role="status" aria-hidden="true" />
          </div>
        ) : null}

        <div className="d-flex justify-content-between align-items-center mt-3 pt-3 border-top">
          <span className="fw-semibold">Totale ordine</span>
          <span className="fw-bold">{moneyFormatter.format(totalCents / 100)}</span>
        </div>

        <button
          type="button"
          className="btn btn-success w-100 mt-3"
          disabled={items.length === 0 || loading}
        >
          Vai al checkout
        </button>
      </div>
    </aside>
  );
}

export default function PrenotaPage() {
  if (!CART_ENABLED) {
    // Flusso legacy: solo wizard prenotazione
    return (
      <main
        className="container"
        style={{ padding: '2rem 1rem', maxWidth: 720, margin: '0 auto' }}
      >
        <h1 style={{ color: '#112f4d', textAlign: 'center' }}>Prenota un tavolo</h1>
        <p style={{ textAlign: 'center', marginBottom: 24 }}>
          Scegli data, orario e numero di persone. Ti risponderemo per confermare.
        </p>

        <BookingWizard />
      </main>
    );
  }

  // Nuovo flusso: carrello + sezioni
  return (
    <CartProvider>
      <main className="container py-5">
        <header className="text-center mb-5">
          <h1 className="display-6" style={{ color: '#112f4d' }}>
            Prenota e costruisci il tuo menù
          </h1>
        </header>

        <div className="row g-4">
          <div className="col-lg-8">
            <SectionAccordion />
          </div>
          <div className="col-lg-4">
            <CartSidebar />
          </div>
        </div>
      </main>
    </CartProvider>
  );
}
