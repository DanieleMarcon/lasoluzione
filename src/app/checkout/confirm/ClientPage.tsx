'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function Inner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = (searchParams.get('token') ?? '').trim();
  const bookingId = searchParams.get('bookingId');

  useEffect(() => {
    if (!token) {
      const p = new URLSearchParams();
      if (bookingId) p.set('bookingId', bookingId);
      p.set('error', 'token_invalid');
      router.replace(`/checkout/email-sent?${p.toString()}`);
      return;
    }
    if (typeof window !== 'undefined') {
      window.location.replace(`/api/bookings/confirm?token=${encodeURIComponent(token)}`);
    }
  }, [token, bookingId, router]);

  return (
    <main className="container" style={{ padding: '2.5rem 1rem', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ color: '#0f172a', textAlign: 'center', marginBottom: '1rem' }}>Reindirizzamento in corso…</h1>
      <p style={{ color: '#475569', fontSize: '1.05rem', textAlign: 'center' }}>
        Stiamo confermando la tua prenotazione e verrai portato automaticamente alla pagina di esito.
      </p>
    </main>
  );
}

export default function ClientPage() {
  return (
    <Suspense fallback={
      <main className="container" style={{ padding: '2.5rem 1rem', maxWidth: 640, margin: '0 auto' }}>
        <p>Caricamento…</p>
      </main>
    }>
      <Inner />
    </Suspense>
  );
}
