'use client';

import { useMemo, useState } from 'react';

import { loadRevolutSDK } from '@/lib/revolutLoader';

type CheckoutSuccessResponse = {
  orderId: string;
  amountCents: number;
  checkoutPublicId?: string;
  hostedPaymentUrl?: string;
  redirectUrl?: string;
  email?: { ok: boolean; skipped?: boolean; error?: string };
  configWarning?: string;
};

export default function CheckoutButton({ orderId, disabled }: { orderId: string; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const mode = useMemo<'sandbox' | 'prod'>(() => {
    const env = (process.env.NEXT_PUBLIC_REVOLUT_ENV || '').toLowerCase();
    return env === 'prod' || env === 'production' || env === 'live' ? 'prod' : 'sandbox';
  }, []);

  async function startCheckout() {
    if (loading || disabled) {
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const { ok, data, error: apiError } = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: CheckoutSuccessResponse;
        error?: string;
      };
      if (!res.ok || !ok || !data) {
        throw new Error(apiError || 'Impossibile avviare il pagamento.');
      }

      const nextWarnings: string[] = [];
      if (data.email && (!data.email.ok || data.email.skipped)) {
        nextWarnings.push(
          'Non siamo riusciti a inviare l’email automatica. Puoi completare il pagamento direttamente da qui.'
        );
      }
      if (data.configWarning) {
        nextWarnings.push(data.configWarning);
      }
      setWarnings(nextWarnings);

      const publicToken = process.env.NEXT_PUBLIC_REVOLUT_PUBLIC_KEY;

      if (data.redirectUrl) {
        window.location.href = data.redirectUrl;
        return;
      }

      if (data.checkoutPublicId && publicToken) {
        try {
          const Revolut = await loadRevolutSDK();
          const instance = await Revolut(data.checkoutPublicId, {
            locale: 'it',
            mode,
            publicToken,
          });
          await instance.pay();
          return;
        } catch (sdkError) {
          console.error('[checkout][client] Revolut SDK error', sdkError);
          if (!data.hostedPaymentUrl) {
            throw sdkError instanceof Error
              ? sdkError
              : new Error('Impossibile caricare il modulo di pagamento Revolut.');
          }
        }
      }

      if (data.checkoutPublicId && !publicToken && !data.hostedPaymentUrl) {
        throw new Error('Checkout non configurato: imposta NEXT_PUBLIC_REVOLUT_PUBLIC_KEY.');
      }

      if (data.hostedPaymentUrl) {
        window.open(data.hostedPaymentUrl, '_blank', 'noopener,noreferrer');
        return;
      }

      throw new Error('Pagamento non disponibile al momento. Riprova più tardi.');
    } catch (err: unknown) {
      console.error('[checkout][client] error', err);
      const message = err instanceof Error ? err.message : 'Pagamento non avviato. Riprova tra poco.';
      setError(message);
      setWarnings([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <button className="btn btn-success w-100" onClick={startCheckout} disabled={disabled || loading}>
        {loading ? (
          <span className="d-inline-flex align-items-center justify-content-center" style={{ gap: '0.5rem' }}>
            <span className="spinner-border spinner-border-sm" role="status" aria-hidden="true" />
            <span>Avvio pagamento…</span>
          </span>
        ) : (
          'Paga con carta / Revolut Pay'
        )}
      </button>
      {warnings.map((warning) => (
        <div key={warning} className="alert alert-warning" role="status" style={{ margin: 0 }}>
          {warning}
        </div>
      ))}
      {error && (
        <div className="alert alert-danger" role="alert" style={{ margin: 0 }}>
          {error}
        </div>
      )}
    </div>
  );
}
