'use client';

import RevolutCheckout from '@revolut/checkout';
import { useRouter } from 'next/navigation';

export default function CheckoutButton({
  paymentRef,
  orderId,
  token,
  hostedPaymentUrl,
  disabled,
}: {
  paymentRef: string;
  orderId?: string;
  token?: string | null;
  hostedPaymentUrl?: string | null;
  disabled?: boolean;
}) {
  const router = useRouter();

  const handlePay = async () => {
    if (disabled) return;

    try {
      if (token) {
        const publicToken = process.env.NEXT_PUBLIC_REVOLUT_PUBLIC_KEY;
        if (!publicToken) {
          throw new Error('Missing Revolut public token');
        }
        const mode = process.env.NEXT_PUBLIC_REVOLUT_ENV === 'prod' ? 'prod' : 'sandbox';
        const sdk = await RevolutCheckout(token, { publicToken, mode, locale: 'it' });
        await sdk.pay();
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
    <button className="btn btn-primary" onClick={handlePay} disabled={disabled}>
      Paga con carta / Revolut Pay
    </button>
  );
}
