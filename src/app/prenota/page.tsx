"use client";

import BookingWizard from '@/components/booking/BookingWizard';
import CartSidebar from '@/components/cart/CartSidebar';
import SectionAccordion from '@/components/cart/SectionAccordion';

const CART_ENABLED = process.env.NEXT_PUBLIC_CART_ENABLED === 'true';

export default function PrenotaPage() {
  if (!CART_ENABLED) {
    return (
      <main className="container" style={{ padding: '2rem 1rem', maxWidth: 720, margin: '0 auto' }}>
        <h1 style={{ color: '#112f4d', textAlign: 'center' }}>Prenota un tavolo</h1>
        <p style={{ textAlign: 'center', marginBottom: 24 }}>Scegli data, orario e numero di persone. Ti risponderemo per confermare.</p>
        <BookingWizard />
      </main>
    );
  }
  return (
    <main className="container py-5">
      <header className="text-center mb-5">
        <h1 className="display-6" style={{ color: '#112f4d' }}>Prenota e costruisci il tuo menù</h1>
        <p className="text-muted mb-0">
          Scegli i piatti dalle sezioni disponibili e procedi al checkout quando sei pronto.
        </p>
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
  );
}
