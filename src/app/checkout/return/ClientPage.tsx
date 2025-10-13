'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function Inner() {
  const sp = useSearchParams();
  const router = useRouter();
  const orderId = sp.get('orderId') || sp.get('id') || '';

  const [status, setStatus] = useState<'checking' | 'finalizing' | 'done' | 'error'>('checking');
  const [message, setMessage] = useState<string>('Verifica del pagamento in corso…');

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const rs = await fetch(`/api/payments/order-status?orderId=${encodeURIComponent(orderId)}`, {
          cache: 'no-store',
        });
        const body = await rs.json();
        if (cancelled) return;

        if (!rs.ok) throw new Error(body?.error || 'status_failed');

        const currentStatus: string | undefined = body?.data?.status ?? body?.status;

        if (currentStatus === 'paid' || currentStatus === 'completed') {
          setStatus('done');
          router.replace(`/checkout/success?orderId=${encodeURIComponent(orderId)}`);
          return;
        }

        if (currentStatus === 'failed' || currentStatus === 'cancelled' || currentStatus === 'declined') {
          setStatus('error');
          setMessage('Pagamento non completato. Puoi riprovare dal carrello.');
          return;
        }

        setTimeout(check, 1500);
      } catch (e: any) {
        if (cancelled) return;
        setStatus('error');
        setMessage(e?.message || 'Errore durante la verifica.');
      }
    }

    if (orderId) check();
    else {
      setStatus('error');
      setMessage('Identificativo ordine mancante.');
    }

    return () => {
      cancelled = true;
    };
  }, [orderId, router]);

  return (
    <main className="container py-5">
      <h1 className="h3 mb-3">Completamento ordine</h1>
      <p className="text-muted">{message}</p>
      {status === 'error' && (
        <a className="btn btn-primary mt-3" href="/prenota">
          Torna al carrello
        </a>
      )}
    </main>
  );
}

export default function ClientPage() {
  return (
    <Suspense fallback={<main className="container py-5"><p>Caricamento…</p></main>}>
      <Inner />
    </Suspense>
  );
}
