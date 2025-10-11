'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

function mapResendError(code?: string | null): string {
  switch (code) {
    case 'booking_not_found':
      return 'Non troviamo la prenotazione indicata. Controlla il link ricevuto.';
    case 'booking_not_pending':
      return 'Questa prenotazione è già stata confermata.';
    case 'rate_limited':
      return 'Hai già richiesto un nuovo invio poco fa. Attendi qualche istante e riprova.';
    case 'invalid_payload':
      return 'Dati non validi. Aggiorna la pagina e riprova.';
    default:
      return 'Non è stato possibile reinviare la conferma. Riprova tra qualche minuto.';
  }
}

function mapVerifyError(code?: string | null): string {
  switch (code) {
    case 'token_expired':
      return 'Il link di conferma è scaduto. Richiedi un nuovo invio della mail.';
    case 'token_missing':
      return 'Il collegamento seguito non è completo. Controlla di aver copiato l’indirizzo corretto.';
    case 'email_mismatch':
    case 'order_not_found':
    case 'token_invalid':
      return 'Il link di conferma non è più valido. Richiedi un nuovo invio della mail.';
    case 'config_error':
      return 'Non è stato possibile confermare la prenotazione. Riprova tra poco o contattaci.';
    default:
      return 'Impossibile confermare la prenotazione con questo link. Richiedi un nuovo invio della mail.';
  }
}

export default function CheckoutEmailSentPage() {
  const searchParams = useSearchParams();
  const bookingIdParam = searchParams.get('bookingId');
  const verifyErrorParam = searchParams.get('error');
  const bookingId = useMemo(() => {
    if (!bookingIdParam) return null;
    const parsed = Number(bookingIdParam);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [bookingIdParam]);

  const initialStatus: 'idle' | 'loading' | 'success' | 'error' = verifyErrorParam ? 'error' : 'idle';
  const initialMessage = verifyErrorParam ? mapVerifyError(verifyErrorParam) : null;

  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(initialStatus);
  const [message, setMessage] = useState<string | null>(initialMessage);
  const feedbackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (status !== 'loading' && message) {
      feedbackRef.current?.focus();
    }
  }, [status, message]);

  useEffect(() => {
    if (verifyErrorParam) {
      setStatus('error');
      setMessage(mapVerifyError(verifyErrorParam));
    }
  }, [verifyErrorParam]);

  useEffect(() => {
    if (!verifyErrorParam && !bookingId && bookingIdParam) {
      setStatus('error');
      setMessage('Il collegamento non è valido.');
    }
  }, [bookingId, bookingIdParam, verifyErrorParam]);

  const handleResend = useCallback(async () => {
    if (!bookingId) {
      setStatus('error');
      setMessage('Il collegamento non è valido.');
      return;
    }

    setStatus('loading');
    setMessage('Invio di una nuova conferma in corso…');

    try {
      const res = await fetch('/api/bookings/resend-confirmation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok: boolean; error?: string }
        | null;

      if (res.ok && body?.ok) {
        setStatus('success');
        setMessage('Abbiamo inviato nuovamente l’email di conferma. Controlla la posta in arrivo.');
        return;
      }

      setStatus('error');
      setMessage(mapResendError(body?.error));
    } catch (error) {
      console.error('[Checkout][email-sent] resend error', error);
      setStatus('error');
      setMessage('Errore di rete durante il reinvio. Riprova.');
    }
  }, [bookingId]);

  return (
    <main className="container" style={{ padding: '2.5rem 1rem', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ color: '#0f172a', textAlign: 'center', marginBottom: '1rem' }}>Ti abbiamo inviato una mail…</h1>
      <p style={{ color: '#475569', fontSize: '1.05rem', textAlign: 'center' }}>
        Controlla la tua casella di posta per confermare la prenotazione.
      </p>

      <div style={{ marginTop: '2rem', display: 'grid', gap: '1rem', justifyItems: 'center' }}>
        <button
          type="button"
          onClick={handleResend}
          disabled={status === 'loading'}
          className="btn btn-outline-secondary"
          style={{ padding: '0.75rem 1.5rem', borderRadius: 999, fontWeight: 600 }}
        >
          {status === 'loading' ? 'Invio in corso…' : 'Non hai ricevuto la mail?'}
        </button>
        <div
          ref={feedbackRef}
          role="status"
          aria-live={status === 'error' ? 'assertive' : 'polite'}
          tabIndex={message ? -1 : undefined}
          style={{
            color: status === 'error' ? '#b91c1c' : '#475569',
            minHeight: message ? 'auto' : 0,
            fontSize: '0.95rem',
            textAlign: 'center',
            outline: 'none',
          }}
        >
          {message}
        </div>
      </div>

      <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        <Link href="/prenota" className="btn btn-primary" style={{ borderRadius: 999, paddingInline: '1.5rem' }}>
          Torna alle prenotazioni
        </Link>
        <Link href="/" className="btn btn-outline-secondary" style={{ borderRadius: 999, paddingInline: '1.5rem' }}>
          Vai alla home
        </Link>
      </div>
    </main>
  );
}
