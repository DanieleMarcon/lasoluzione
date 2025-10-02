'use client';

import { useCallback, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function FakePaymentPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [loading, setLoading] = useState<'confirm' | 'cancel' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const disabled = useMemo(() => loading !== null, [loading]);

  const callApi = useCallback(
    async (action: 'fake-confirm' | 'fake-cancel') => {
      if (!token) return;
      setLoading(action === 'fake-confirm' ? 'confirm' : 'cancel');
      setError(null);
      setMessage(null);

      try {
        const res = await fetch(`/api/bookings/${action}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token }),
        });

        const body = await res.json().catch(() => ({}));

        if (!res.ok || !body.ok) {
          setError(body?.error || 'Operazione non riuscita.');
          return;
        }

        if (action === 'fake-confirm') {
          setMessage('Pagamento completato! Prenotazione confermata.');
        } else {
          setMessage('Pagamento annullato. Prenotazione annullata.');
        }
      } catch (err) {
        console.error('[fake-payment] request error', err);
        setError('Errore di rete. Riprova.');
      } finally {
        setLoading(null);
      }
    },
    [token]
  );

  const goBack = useCallback(() => {
    router.push('/prenota');
  }, [router]);

  if (!token) {
    return (
      <main style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Pagamento simulato</h1>
        <p>Token non fornito. Torna alla prenotazione.</p>
        <button className="btn" onClick={goBack}>
          Torna alla prenotazione
        </button>
      </main>
    );
  }

  return (
    <main style={{ padding: '2rem', maxWidth: '480px', margin: '0 auto' }}>
      <h1>Pagamento simulato</h1>
      <p>
        Stai finalizzando il pagamento per la tua prenotazione. Questo flusso è solo una simulazione, non verrà
        addebitato nulla.
      </p>
      <div style={{ display: 'flex', gap: '0.75rem', marginTop: '1.5rem' }}>
        <button className="btn" disabled={disabled} onClick={() => callApi('fake-confirm')}>
          {loading === 'confirm' ? 'Completamento…' : 'Completa pagamento'}
        </button>
        <button
          className="btn"
          disabled={disabled}
          onClick={() => callApi('fake-cancel')}
          style={{ background: 'var(--color-border)' }}
        >
          {loading === 'cancel' ? 'Annullamento…' : 'Annulla pagamento'}
        </button>
      </div>

      {message && <p style={{ marginTop: '1.5rem', color: 'var(--color-success, green)' }}>{message}</p>}
      {error && <p style={{ marginTop: '1.5rem', color: 'var(--color-error, crimson)' }}>{error}</p>}

      <p style={{ marginTop: '2rem' }}>
        Token corrente: <code>{token}</code>
      </p>
      <button className="btn" style={{ marginTop: '1rem' }} onClick={goBack}>
        Torna alla prenotazione
      </button>
    </main>
  );
}
