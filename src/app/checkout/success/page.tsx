'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useEffect } from 'react';

import { useCart } from '@/hooks/useCart';

export default function CheckoutSuccessPage() {
  const searchParams = useSearchParams();
  const orderId = searchParams.get('orderId');
  const bookingId = searchParams.get('bookingId');
  const { clearCartToken } = useCart();

  useEffect(() => {
    clearCartToken();
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem('order_verify_token');
    }
  }, [clearCartToken]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-10 text-center shadow-lg">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-3xl">
          ✅
        </div>
        <h1 className="mt-6 text-3xl font-semibold text-slate-900 md:text-4xl">
          Prenotazione confermata!
        </h1>
        <p className="mt-4 text-base text-slate-600 md:text-lg">
          Grazie per la tua prenotazione. Ti abbiamo inviato un’email con tutti i dettagli dell’ordine.
        </p>
        {(orderId || bookingId) && (
          <div className="mt-6 space-y-1 text-sm text-slate-500">
            {orderId && <p>ID ordine: {orderId}</p>}
            {bookingId && <p>ID prenotazione: {bookingId}</p>}
          </div>
        )}
        <div className="mt-10 flex justify-center">
          <Link
            href="/"
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            Torna alla Home
          </Link>
        </div>
      </div>
    </main>
  );
}
