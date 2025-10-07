'use client';

import { useState } from 'react';

import loadRevolutCheckout from '@/lib/revolut-checkout';

export default function CheckoutButton({ orderId, disabled }: { orderId: string; disabled?: boolean }) {
  const [loading, setLoading] = useState(false);

  async function startCheckout() {
    try {
      setLoading(true);
      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const { ok, data, error } = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        data?: { mode: 'free'; redirectUrl: string; orderId: string } | { mode: 'widget'; orderId: string; paymentRef: string; token: string };
        error?: string;
      };
      if (!ok || !data) throw new Error(error || 'Checkout error');

      if (data.mode === 'free') {
        window.location.href = data.redirectUrl;
        return;
      }

      const { token } = data;
      const instance = await loadRevolutCheckout(token, 'sandbox');

      instance.payWithPopup({
        onSuccess() {
          window.location.href = `/checkout/return?orderId=${encodeURIComponent(orderId)}`;
        },
        onError() {
          window.location.href = `/checkout/return?orderId=${encodeURIComponent(orderId)}`;
        },
        onCancel() {
          window.location.href = `/checkout/cancel?orderId=${encodeURIComponent(orderId)}`;
        },
      });
    } catch (error: unknown) {
      console.error('[checkout][client] error', error);
      const message = error instanceof Error ? error.message : 'Pagamento non avviato. Riprova tra poco.';
      alert(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="btn btn-success w-100" onClick={startCheckout} disabled={disabled || loading}>
      {loading ? 'Avvio pagamento…' : 'Paga con carta / Revolut Pay'}
    </button>
  );
}
