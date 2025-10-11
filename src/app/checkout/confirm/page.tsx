'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function CheckoutConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const bookingId = searchParams.get('bookingId');

  useEffect(() => {
    const trimmedToken = token.trim();
    if (!trimmedToken) {
      const params = new URLSearchParams();
      if (bookingId) {
        params.set('bookingId', bookingId);
      }
      params.set('error', 'token_invalid');
      router.replace(`/checkout/email-sent?${params.toString()}`);
      return;
    }

    if (typeof window === 'undefined') {
      return;
    }

    const confirmUrl = `/api/payments/email-verify?token=${encodeURIComponent(trimmedToken)}`;
    window.location.replace(confirmUrl);
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
