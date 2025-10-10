'use client';

import RevolutCheckout from '@revolut/checkout';
import { useRouter } from 'next/navigation';
import { useId, useState } from 'react';

export default function CheckoutButton({
  paymentRef,
  orderId,
  token,
  hostedPaymentUrl,
  disabled,
  onBeforePay,
}: {
  paymentRef: string;
  orderId?: string;
  token?: string | null;
  hostedPaymentUrl?: string | null;
  disabled?: boolean;
  onBeforePay?: (payload: { agreePrivacy: boolean; agreeMarketing: boolean }) => void | Promise<void>;
}) {
  const router = useRouter();
  const [agreePrivacy, setAgreePrivacy] = useState(false);
  const [agreeMarketing, setAgreeMarketing] = useState(false);
  const [privacyError, setPrivacyError] = useState<string | null>(null);
  const privacyErrorId = useId();

  const handlePay = async () => {
    if (disabled) return;

    if (!agreePrivacy) {
      setPrivacyError('Devi accettare la privacy per procedere.');
      return;
    }

    setPrivacyError(null);

    try {
      if (onBeforePay) {
        await onBeforePay({ agreePrivacy, agreeMarketing });
      }

      if (token) {
        const publicToken = process.env.NEXT_PUBLIC_REVOLUT_PUBLIC_KEY;
        if (!publicToken) {
          throw new Error('Missing Revolut public token');
        }
        const mode = process.env.NEXT_PUBLIC_REVOLUT_ENV === 'prod' ? 'prod' : 'sandbox';
        const sdk = await RevolutCheckout(publicToken, { mode, locale: 'it' });
        await sdk.pay(token);
        if (orderId) {
          router.push(`/checkout/return?orderId=${encodeURIComponent(orderId)}`);
        } else {
          router.push(`/checkout/return?ref=${encodeURIComponent(paymentRef)}`);
        }
        return;
      }
    } catch (error) {
      console.error('[checkout] Revolut popup error', error);
    }

    if (hostedPaymentUrl) {
      window.location.href = hostedPaymentUrl;
      return;
    }

    alert('Impossibile avviare il pagamento. Riprova più tardi.');
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

      <button className="btn btn-primary" onClick={handlePay} disabled={disabled}>
        Paga con carta / Revolut Pay
      </button>
    </div>
  );
}
