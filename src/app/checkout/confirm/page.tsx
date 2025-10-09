'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';

type ConfirmState = 'loading' | 'success' | 'expired' | 'already_used' | 'invalid' | 'error';

type ApiSuccess = { ok: true; state: 'confirmed' };
type ApiError = { ok: false; state: 'invalid' | 'expired' | 'used' };

type ApiResponse = ApiSuccess | ApiError | null;

function mapState(state: ApiResponse, tokenPresent: boolean): ConfirmState {
  if (!tokenPresent) return 'invalid';
  if (!state) return 'error';
  if (state.ok && state.state === 'confirmed') return 'success';
  if (!state.ok) {
    if (state.state === 'expired') return 'expired';
    if (state.state === 'used') return 'already_used';
    if (state.state === 'invalid') return 'invalid';
  }
  return 'error';
}

function mapMessage(status: ConfirmState): string {
  switch (status) {
    case 'success':
      return 'Prenotazione confermata! Ti abbiamo inviato una email di riepilogo.';
    case 'expired':
      return 'Il link di conferma è scaduto. Richiedi un nuovo invio dalla pagina precedente.';
    case 'already_used':
      return 'Questo link è già stato utilizzato. Se hai bisogno di assistenza contattaci.';
    case 'invalid':
      return 'Il link non è valido. Controlla di aver copiato l’indirizzo completo.';
    default:
      return 'Si è verificato un errore durante la conferma della prenotazione. Riprova più tardi.';
  }
}

export default function CheckoutConfirmPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const tokenPresent = token.trim().length > 0;
  const bookingIdParam = searchParams.get('bookingId');
  const bookingId = useMemo(() => {
    if (!bookingIdParam) return null;
    const parsed = Number(bookingIdParam);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }, [bookingIdParam]);

  const [status, setStatus] = useState<ConfirmState>(tokenPresent ? 'loading' : 'invalid');
  const [message, setMessage] = useState<string>(() =>
    tokenPresent ? 'Conferma della prenotazione in corso…' : 'Il link non è valido. Controlla di aver copiato l’indirizzo completo.',
  );
  const feedbackRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (status !== 'loading') {
      feedbackRef.current?.focus();
    }
  }, [status]);

  useEffect(() => {
    if (!tokenPresent) {
      return;
    }

    let cancelled = false;

    (async () => {
      setStatus('loading');
      setMessage('Conferma della prenotazione in corso…');
      try {
        const res = await fetch(`/api/bookings/confirm?token=${encodeURIComponent(token)}`);
        const body = (await res.json().catch(() => null)) as ApiResponse;
        if (cancelled) return;
        const nextStatus = mapState(body, tokenPresent);
        setStatus(nextStatus);
        setMessage(mapMessage(nextStatus));
      } catch (error) {
        console.error('[Checkout][confirm] error', error);
        if (cancelled) return;
        setStatus('error');
        setMessage(mapMessage('error'));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, tokenPresent]);

  const heading = useMemo(() => {
    switch (status) {
      case 'success':
        return 'Prenotazione confermata';
      case 'expired':
        return 'Link scaduto';
      case 'already_used':
        return 'Link già utilizzato';
      case 'invalid':
        return 'Link non valido';
      default:
        return 'Conferma prenotazione';
    }
  }, [status]);

  const isPositive = status === 'success';
  const canResend = (status === 'expired' || status === 'invalid') && bookingId;
  const emailSentHref = useMemo(() => {
    if (!bookingId) return '/checkout/email-sent';
    return `/checkout/email-sent?bookingId=${bookingId}`;
  }, [bookingId]);

  return (
    <main className="container" style={{ padding: '2.5rem 1rem', maxWidth: 640, margin: '0 auto' }}>
      <h1 style={{ color: isPositive ? '#14532d' : '#0f172a', textAlign: 'center', marginBottom: '1rem' }}>{heading}</h1>
      <div
        ref={feedbackRef}
        role="status"
        aria-live={status === 'error' || status === 'invalid' ? 'assertive' : 'polite'}
        tabIndex={-1}
        style={{
          color: isPositive ? '#14532d' : '#475569',
          backgroundColor: isPositive ? 'rgba(20, 83, 45, 0.08)' : 'rgba(148, 163, 184, 0.2)',
          borderRadius: 16,
          padding: '1.5rem',
          fontSize: '1.05rem',
          outline: 'none',
        }}
      >
        {message}
      </div>

      <div style={{ marginTop: '2.5rem', display: 'flex', justifyContent: 'center', gap: '1rem', flexWrap: 'wrap' }}>
        {canResend ? (
          <Link href={emailSentHref} className="btn btn-primary" style={{ borderRadius: 999, paddingInline: '1.5rem' }}>
            Richiedi un nuovo invio
          </Link>
        ) : null}
        <Link href="/prenota" className="btn btn-outline-secondary" style={{ borderRadius: 999, paddingInline: '1.5rem' }}>
          Torna alle prenotazioni
        </Link>
        <Link href="/" className="btn btn-outline-secondary" style={{ borderRadius: 999, paddingInline: '1.5rem' }}>
          Vai alla home
        </Link>
      </div>
    </main>
  );
}
