'use client';

import { useState } from 'react';

declare global {
  interface Window {
    RevolutCheckout?: (publicKey: string) => { pay(publicId: string): Promise<void> };
  }
}

const PUBLIC_KEY = process.env.NEXT_PUBLIC_REVOLUT_PUBLIC_KEY;

type Props = { orderId: string; disabled?: boolean };

export default function CheckoutButton({ orderId, disabled }: Props) {
  const [loading, setLoading] = useState(false);

  async function startCheckout() {
    try {
      setLoading(true);
      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      const body = (await res.json().catch(() => null)) as
        | { ok: boolean; data?: { mode: 'free'; redirectUrl: string } | { mode: 'widget'; publicId: string }; error?: string }
        | null;

      if (!res.ok || !body?.ok || !body.data) {
        throw new Error(body?.error || 'Checkout error');
      }

      if (body.data.mode === 'free') {
        window.location.href = body.data.redirectUrl;
        return;
      }

      const publicId = body.data.publicId;

      if (!PUBLIC_KEY) {
        throw new Error('Revolut public key is not configured');
      }

      await ensureRevolutScript();

      const revolutCheckout = window.RevolutCheckout;
      if (typeof revolutCheckout !== 'function') {
        throw new Error('RevolutCheckout not available');
      }

      const widget = revolutCheckout(PUBLIC_KEY);
      if (!widget || typeof widget.pay !== 'function') {
        throw new Error('Revolut widget not available');
      }

      await widget.pay(publicId);
    } catch (error) {
      console.error('[checkout][client] error', error);
      alert('Pagamento non avviato. Riprova tra poco.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <button className="btn btn-success w-100" onClick={startCheckout} disabled={disabled || loading}>
      {loading ? 'Avvio pagamento…' : 'Paga con Revolut'}
    </button>
  );
}

function ensureRevolutScript(): Promise<void> {
  const id = 'revolut-pay-script';
  if (document.getElementById(id)) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.id = id;
    script.src = 'https://merchant.revolut.com/checkout.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Revolut script'));
    document.head.appendChild(script);
  });
}
