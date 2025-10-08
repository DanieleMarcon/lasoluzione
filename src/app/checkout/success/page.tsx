'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { useCart } from '@/hooks/useCart';

export default function CheckoutSuccessPage() {
  const sp = useSearchParams();
  const orderId = sp.get('orderId');
  const { clearCartToken } = useCart();

  useEffect(() => {
    clearCartToken();
  }, [clearCartToken]);

  return (
    <main className="container" style={{ padding: '2.5rem 1rem', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ color: '#14532d', textAlign: 'center', marginBottom: '1rem' }}>Grazie per l’ordine!</h1>
      <p style={{ color: '#0f172a', fontSize: '1.1rem', textAlign: 'center' }}>
        Il tuo ordine{orderId ? ` #${orderId}` : ''} è stato confermato con successo. Riceverai una email di riepilogo con tutti i dettagli.
      </p>
      <div style={{ marginTop: '2rem', display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <Link
          href="/prenota"
          className="btn btn-primary"
          style={{ paddingInline: '1.5rem', borderRadius: 999 }}
        >
          Torna alle prenotazioni
        </Link>
        <Link
          href="/"
          className="btn btn-outline-secondary"
          style={{ paddingInline: '1.5rem', borderRadius: 999 }}
        >
          Vai alla home
        </Link>
      </div>
    </main>
  );
}
