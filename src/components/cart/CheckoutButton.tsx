'use client';

import RevolutCheckout from '@revolut/checkout';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

type CheckoutRequestPayload = {
  name: string;
  email: string;
  phone: string;
  notes?: string | null;
};

type VerifySentResponse = {
  ok: true;
  state: 'verify_sent';
  verifyToken?: string;
};

type ConfirmedResponse = {
  ok: true;
  state: 'confirmed';
  orderId: string;
  nextUrl?: string | null;
};

type PaidRedirectResponse = {
  ok: true;
  state: 'paid_redirect';
  orderId: string;
  checkoutPublicId?: string | null;
  paymentRef?: string | null;
  hostedPaymentUrl?: string | null;
  url?: string | null;
};

type CheckoutResponse = VerifySentResponse | ConfirmedResponse | PaidRedirectResponse | { ok: false; error?: string };

type CheckoutButtonProps = {
  disabled?: boolean;
  resolveCheckoutPayload: () => Promise<CheckoutRequestPayload> | CheckoutRequestPayload;
  onError?: (message: string) => void;
  onVerifySent?: () => void;
};

function trimValue(value: string | null | undefined): string {
  if (typeof value !== 'string') return '';
  return value.trim();
}

function readVerifyToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.sessionStorage.getItem('order_verify_token');
  } catch (error) {
    console.warn('[checkout] unable to read verify token', error);
    return null;
  }
}

function storeVerifyToken(token?: string | null) {
  if (typeof window === 'undefined' || !token) return;
  try {
    window.sessionStorage.setItem('order_verify_token', token);
  } catch (error) {
    console.warn('[checkout] unable to persist verify token', error);
  }
}

function clearVerifyToken() {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem('order_verify_token');
  } catch (error) {
    console.warn('[checkout] unable to clear verify token', error);
  }
}

export default function CheckoutButton({
  disabled,
  resolveCheckoutPayload,
  onError,
  onVerifySent,
}: CheckoutButtonProps) {
  const router = useRouter();
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const privacyErrorId = useId();

  const startRevolutFlow = async (payload: PaidRedirectResponse) => {
    const checkoutToken = payload.checkoutPublicId || payload.paymentRef || null;
    const redirectUrl = payload.url || payload.hostedPaymentUrl || null;

    if (checkoutToken) {
      try {
        const publicToken = process.env.NEXT_PUBLIC_REVOLUT_PUBLIC_KEY;
        if (!publicToken) {
          throw new Error('Missing Revolut public token');
        }
        const env = process.env.NEXT_PUBLIC_REVOLUT_ENV;
        const mode = env === 'prod' || env === 'live' ? 'prod' : 'sandbox';
        const sdk = await RevolutCheckout(publicToken, { mode, locale: 'it' });
        await sdk.pay(checkoutToken);
        if (payload.orderId) {
          router.push(`/checkout/return?orderId=${encodeURIComponent(payload.orderId)}`);
        } else if (payload.paymentRef) {
          router.push(`/checkout/return?ref=${encodeURIComponent(payload.paymentRef)}`);
        } else {
          router.push('/checkout/return');
        }
        return;
      } catch (error) {
        console.error('[checkout] Revolut popup error', error);
      }
    }

    if (redirectUrl) {
      window.location.href = redirectUrl;
      return;
    }

    const message = 'Impossibile avviare il pagamento. Riprova più tardi.';
    setErrorMessage(message);
    onError?.(message);
  };

  const handlePay = async () => {
    if (disabled || submitting) return;

    if (!agreePrivacy) {
      setPrivacyError('Devi accettare la privacy per procedere.');
      return;
    }

    setPrivacyError(null);
    setStatusMessage(null);
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const payloadRaw = await resolveCheckoutPayload();
      const name = trimValue(payloadRaw?.name);
      const email = trimValue(payloadRaw?.email);
      const phone = trimValue(payloadRaw?.phone);
      const notesValue = trimValue(payloadRaw?.notes ?? undefined);

      if (!name || !email || !phone) {
        const message = 'Dati cliente mancanti. Controlla i campi obbligatori.';
        setErrorMessage(message);
        onError?.(message);
        return;
      }

      const body: Record<string, unknown> = {
        name,
        email,
        phone,
        notes: notesValue,
        agreePrivacy: true,
        agreeMarketing,
      };

      const storedToken = readVerifyToken();
      if (storedToken) {
        body.verifyToken = storedToken;
      }

      const response = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = (await response.json().catch(() => null)) as CheckoutResponse | null;

      if (!response.ok || !data || !data.ok) {
        const message = (data as any)?.error || 'Impossibile completare il checkout. Riprova.';
        setErrorMessage(message);
        onError?.(message);
        return;
      }

      if (data.state === 'verify_sent') {
        storeVerifyToken(data.verifyToken);
        const message =
          'Ti abbiamo inviato un’email per verificare l’indirizzo. Controlla la posta e clicca il link per continuare.';
        setStatusMessage(message);
        onVerifySent?.();
        return;
      }

      if (data.state === 'confirmed') {
        clearVerifyToken();
        const target = data.nextUrl || `/checkout/success?orderId=${encodeURIComponent(data.orderId)}`;
        router.push(target);
        return;
      }

      if (data.state === 'paid_redirect') {
        clearVerifyToken();
        await startRevolutFlow(data);
        return;
      }

      const message = 'Risposta inattesa dal server. Riprova.';
      setErrorMessage(message);
      onError?.(message);
    } catch (error) {
      console.error('[checkout] submit error', error);
      const message = 'Errore durante il checkout. Riprova più tardi.';
      setErrorMessage(message);
      onError?.(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'grid', gap: '0.75rem' }}>
      <div style={{ display: 'grid', gap: '0.5rem' }}>
        <div className="form-check">
          <input
            id="checkout-agree-privacy"
            type="checkbox"
            className="form-check-input"
            checked={agreePrivacy}
            onChange={(event) => setAgreePrivacy(event.target.checked)}
            aria-invalid={privacyError ? 'true' : undefined}
            aria-describedby={privacyError ? privacyErrorId : undefined}
          />
          <label className="form-check-label" htmlFor="checkout-agree-privacy">
            Ho letto e accetto l’informativa sulla privacy*
          </label>
        </div>
        {privacyError ? (
          <p
            id={privacyErrorId}
            role="alert"
            className="text-danger mb-0"
            style={{ fontSize: '0.9rem' }}
          >
            {privacyError}
          </p>
        ) : null}
        <div className="form-check">
          <input
            id="checkout-agree-marketing"
            type="checkbox"
            className="form-check-input"
            checked={agreeMarketing}
            onChange={(event) => setAgreeMarketing(event.target.checked)}
          />
          <label className="form-check-label" htmlFor="checkout-agree-marketing">
            Voglio ricevere aggiornamenti e promozioni via email
          </label>
        </div>
      </div>

      {statusMessage ? (
        <div className="alert alert-info mb-0" role="status">
          {statusMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="alert alert-danger mb-0" role="alert">
          {errorMessage}
        </div>
      ) : null}

      <button className="btn btn-primary" onClick={handlePay} disabled={disabled || submitting}>
        {submitting ? 'Elaborazione…' : 'Paga con carta / Revolut Pay'}
      </button>
    </div>
  );
}
