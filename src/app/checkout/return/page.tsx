'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function CheckoutReturn() {
  const sp = useSearchParams();
  const router = useRouter();
  const paymentRef = sp.get('ref') || sp.get('paymentRef') || '';

  const [status, setStatus] = useState<'checking' | 'finalizing' | 'done' | 'error'>('checking');
  const [message, setMessage] = useState<string>('Verifica del pagamento in corso…');

  useEffect(() => {
    let cancelled = false;

    async function check() {
      try {
        const rs = await fetch(`/api/payments/order-status?ref=${encodeURIComponent(paymentRef)}`, { cache: 'no-store' });
        const body = await rs.json();
        if (cancelled) return;

        if (!rs.ok) throw new Error(body?.error || 'status_failed');

        const currentStatus: string | undefined = body?.data?.status ?? body?.status;

        if (currentStatus === 'completed') {
          setStatus('finalizing');
          setMessage('Pagamento confermato. Finalizzo l’ordine…');

          const fr = await fetch('/api/orders/finalize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ paymentRef }),
          });
          const fb = await fr.json();
          if (!fr.ok || !fb?.ok) throw new Error(fb?.error || 'finalize_failed');

          setStatus('done');
          router.replace(`/prenota/complete?order=${encodeURIComponent(fb.orderId)}`);
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

    if (paymentRef) check();
    else {
      setStatus('error');
      setMessage('Riferimento pagamento mancante.');
    }

    return () => {
      cancelled = true;
    };
  }, [paymentRef, router]);

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
