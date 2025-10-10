'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

import { useCart } from '@/hooks/useCart';
import { formatCurrency } from '@/lib/formatCurrency';

type VerificationStatus = 'idle' | 'pending' | 'verified';

type FormValues = {
  email: string;
  name: string;
  phone: string;
  notes: string;
  agreePrivacy: boolean;
  agreeMarketing: boolean;
};

const INITIAL_VALUES: FormValues = {
  email: '',
  name: '',
  phone: '',
  notes: '',
  agreePrivacy: false,
  agreeMarketing: false,
};

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { cart, loading, error } = useCart();

  const [formValues, setFormValues] = useState<FormValues>(INITIAL_VALUES);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('idle');

  const verifiedParam = searchParams.get('verified') === '1';

  const cartItems = cart?.items ?? [];
  const totalCents = cart?.totalCents ?? 0;

  const summaryDescription = useMemo(() => {
    if (loading) return 'Caricamento del carrello in corso…';
    if (error) return 'Impossibile caricare il carrello. Riprova più tardi.';
    if (!cartItems.length) return 'Il carrello è vuoto. Torna al catalogo per continuare gli acquisti.';
    return 'Controlla i dettagli e completa il checkout.';
  }, [loading, error, cartItems.length]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    if (verifiedParam) {
      window.sessionStorage.removeItem('order_verify_token');
      setVerificationStatus('verified');
      return;
    }

    const storedToken = window.sessionStorage.getItem('order_verify_token');
    if (storedToken) {
      setVerificationStatus('pending');
    }
  }, [verifiedParam]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (verificationStatus === 'pending') {
      return;
    }

    setFormError(null);

    if (!formValues.agreePrivacy) {
      setFormError('Per procedere è necessario accettare l\'informativa sulla privacy.');
      return;
    }

    setSubmitting(true);

    const verifyToken =
      typeof window !== 'undefined'
        ? window.sessionStorage.getItem('order_verify_token') || undefined
        : undefined;

    const payload = {
      email: formValues.email,
      name: formValues.name,
      phone: formValues.phone,
      notes: formValues.notes,
      agreePrivacy: formValues.agreePrivacy,
      agreeMarketing: !!formValues.agreeMarketing,
      items: cartItems.map((item) => ({
        productId: item.productId,
        quantity: item.quantity,
      })),
      verifyToken,
    };

    try {
      const response = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        let message = 'Impossibile completare il checkout in questo momento. Riprova più tardi.';
        try {
          const data = await response.json();
          if (typeof data?.error === 'string') {
            message = data.error;
          } else if (typeof data?.message === 'string') {
            message = data.message;
          }
        } catch (parseError) {
          // ignore json parse errors
        }
        setFormError(message);
        setSubmitting(false);
        return;
      }

      const result = await response.json();

      switch (result?.state) {
        case 'verify_sent': {
          if (typeof window !== 'undefined' && typeof result?.token === 'string' && result.token) {
            window.sessionStorage.setItem('order_verify_token', result.token);
          }
          setVerificationStatus('pending');
          setSubmitting(false);
          break;
        }
        case 'confirmed': {
          if (typeof result?.orderId === 'string' && result.orderId) {
            router.push(`/checkout/success?orderId=${encodeURIComponent(result.orderId)}`);
            return;
          }
          setFormError('Ordine confermato ma senza identificativo valido. Contatta il supporto.');
          setSubmitting(false);
          break;
        }
        case 'paid_redirect': {
          if (typeof result?.url === 'string' && result.url) {
            window.location.href = result.url;
            return;
          }
          setFormError('Redirezione pagamento non disponibile. Riprova.');
          setSubmitting(false);
          break;
        }
        default: {
          setFormError('Risposta inattesa dal server. Riprova più tardi.');
          setSubmitting(false);
        }
      }
    } catch (requestError) {
      setFormError('Si è verificato un errore imprevisto. Controlla la connessione e riprova.');
      setSubmitting(false);
    }
  };

  const isSubmitDisabled = submitting || verificationStatus === 'pending';

  return (
    <div className="bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 lg:flex-row lg:px-8">
        <div className="w-full lg:w-2/3">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Checkout</h1>
          <p className="mt-2 text-sm text-slate-600">{summaryDescription}</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6" noValidate>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
              <div className="flex flex-col">
                <label htmlFor="email" className="text-sm font-medium text-slate-700">
                  Email
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={formValues.email}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, email: event.target.value }))
                  }
                  className="mt-2 rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="flex flex-col">
                <label htmlFor="name" className="text-sm font-medium text-slate-700">
                  Nome e cognome
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  value={formValues.name}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, name: event.target.value }))
                  }
                  className="mt-2 rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="flex flex-col">
                <label htmlFor="phone" className="text-sm font-medium text-slate-700">
                  Telefono
                </label>
                <input
                  id="phone"
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  value={formValues.phone}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, phone: event.target.value }))
                  }
                  className="mt-2 rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>

              <div className="flex flex-col sm:col-span-2">
                <label htmlFor="notes" className="text-sm font-medium text-slate-700">
                  Note (facoltative)
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={4}
                  value={formValues.notes}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  className="mt-2 rounded-md border border-slate-300 px-3 py-2 text-base text-slate-900 shadow-sm focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
                />
              </div>
            </div>

            <div className="space-y-4">
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  checked={formValues.agreePrivacy}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, agreePrivacy: event.target.checked }))
                  }
                  required
                />
                <span className="text-sm text-slate-700">
                  Ho letto e accetto l&apos;informativa privacy (obbligatorio).
                </span>
              </label>

              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  checked={formValues.agreeMarketing}
                  onChange={(event) =>
                    setFormValues((prev) => ({ ...prev, agreeMarketing: event.target.checked }))
                  }
                />
                <span className="text-sm text-slate-700">
                  Voglio ricevere aggiornamenti e offerte via email (facoltativo).
                </span>
              </label>
            </div>

            {verificationStatus === 'pending' && (
              <div
                className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3"
                role="status"
                aria-live="polite"
              >
                <p className="text-sm font-semibold text-amber-900">Verifica email inviata</p>
                <p className="mt-1 text-sm text-amber-900">
                  Ti abbiamo inviato una mail di verifica. Controlla la casella di posta e segui il link
                  per completare l&apos;ordine.
                </p>
              </div>
            )}

            {verificationStatus === 'verified' && (
              <div
                className="rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3"
                role="status"
                aria-live="polite"
              >
                <p className="text-sm font-semibold text-emerald-900">Email verificata</p>
                <p className="mt-1 text-sm text-emerald-900">
                  Grazie! Puoi completare il checkout confermando nuovamente l&apos;ordine.
                </p>
              </div>
            )}

            {formError && (
              <div
                className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800"
                role="alert"
                aria-live="assertive"
              >
                {formError}
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitDisabled}
              className="inline-flex w-full items-center justify-center rounded-md bg-slate-900 px-4 py-2 text-base font-medium text-white transition disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Invio in corso…' : verificationStatus === 'pending' ? 'In attesa di verifica…' : 'Conferma ordine'}
            </button>
          </form>
        </div>

        <aside className="w-full lg:w-1/3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-lg font-semibold text-slate-900">Il tuo ordine</h2>
            <p className="mt-1 text-sm text-slate-600">{summaryDescription}</p>

            <div className="mt-6 space-y-4">
              {cartItems.length === 0 && !loading ? (
                <p className="text-sm text-slate-500">Nessun articolo nel carrello.</p>
              ) : (
                cartItems.map((item) => (
                  <div key={item.id ?? `${item.productId}-${item.quantity}`}
                    className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 last:border-b-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{item.nameSnapshot ?? item.name}</p>
                      <p className="text-xs text-slate-500">Quantità: {item.quantity}</p>
                    </div>
                    {typeof item.priceCents === 'number' && (
                      <p className="text-sm font-semibold text-slate-900">
                        {formatCurrency(item.priceCents / 100)}
                      </p>
                    )}
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
              <span className="text-sm font-medium text-slate-700">Totale</span>
              <span className="text-lg font-semibold text-slate-900">
                {formatCurrency(totalCents / 100)}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
