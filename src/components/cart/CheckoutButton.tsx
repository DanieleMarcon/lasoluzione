'use client';

import RevolutCheckout from '@revolut/checkout';
import { useRouter } from 'next/navigation';

export default function CheckoutButton({
  paymentRef,
  token,
  hostedPaymentUrl,
  disabled,
}: {
  paymentRef: string;
  token?: string | null;
  hostedPaymentUrl?: string | null;
  disabled?: boolean;
}) {
  const router = useRouter();

  const handlePay = async () => {
    if (disabled) return;

    try {
      if (token) {
        const sdk = await RevolutCheckout(token, {
          mode: process.env.NEXT_PUBLIC_REVOLUT_ENV === 'prod' ? 'prod' : 'sandbox',
          locale: 'it',
        });
        await sdk.payWithPopup({
          onSuccess: () => router.push(`/checkout/return?ref=${encodeURIComponent(paymentRef)}`),
          onError: () => alert('Pagamento non riuscito. Riprova.'),
          onCancel: () => router.push('/prenota'),
        });
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
