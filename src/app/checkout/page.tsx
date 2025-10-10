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

// Helpers robusti contro DTO diversi
function itemName(i: any): string {
  return i?.nameSnapshot ?? i?.name ?? i?.title ?? 'Articolo';
}
function itemQty(i: any): number {
  const n = Number(i?.quantity ?? i?.qty ?? i?.count ?? 1);
  return Number.isFinite(n) && n > 0 ? n : 1;
}
function itemProductId(i: any): number | string | undefined {
  return i?.productId ?? i?.id ?? i?.product?.id ?? undefined;
}

export default function CheckoutPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { cart, loading, error } = useCart();

  const [formValues, setFormValues] = useState<FormValues>(INITIAL_VALUES);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [verificationStatus, setVerificationStatus] = useState<VerificationStatus>('idle');

  // ritorno dal link di verifica (?verified=1)
  const verifiedParam = searchParams.get('verified') === '1';

  const cartItems: any[] = cart?.items ?? [];
  const totalCents = cart?.totalCents ?? 0;

  const summaryDescription = useMemo(() => {
    if (loading) return 'Caricamento del carrello in corso…';
    if (error) return 'Impossibile caricare il carrello. Riprova più tardi.';
    if (!cartItems.length) return 'Il carrello è vuoto. Torna al catalogo per continuare gli acquisti.';
    return 'Controlla i dettagli e completa il checkout.';
  }, [loading, error, cartItems.length]);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (verifiedParam) {
      window.sessionStorage.removeItem('order_verify_token');
      setVerificationStatus('verified');
      return;
    }

    const stored = window.sessionStorage.getItem('order_verify_token');
    if (stored) setVerificationStatus('pending');
  }, [verifiedParam]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (verificationStatus === 'pending') return;

    setFormError(null);

    if (!formValues.agreePrivacy) {
      setFormError('Per procedere è necessario accettare l’informativa sulla privacy.');
      return;
    }

    setSubmitting(true);

    const verifyToken =
      typeof window !== 'undefined'
        ? window.sessionStorage.getItem('order_verify_token') || undefined
        : undefined;

    // Items compatti (productId + quantity); filtra quelli senza productId
    const payloadItems = cartItems
      .map((it) => ({
        productId: itemProductId(it),
        quantity: itemQty(it),
      }))
      .filter((it) => it.productId != null);

    const payload = {
      email: formValues.email.trim(),
      name: formValues.name.trim(),
      phone: formValues.phone.trim(),
      notes: formValues.notes.trim() || undefined,
      agreePrivacy: formValues.agreePrivacy,
      agreeMarketing: !!formValues.agreeMarketing,
      items: payloadItems,
      verifyToken,
    };

    try {
      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const result = await res.json().catch(() => null);

      if (!res.ok) {
        const msg =
          (result && (result.error || result.message)) ||
          'Impossibile completare il checkout in questo momento. Riprova più tardi.';
        setFormError(String(msg));
        setSubmitting(false);
        return;
      }

      switch (result?.state) {
        case 'verify_sent': {
          // Accetta sia "token" che "verifyToken"
          const t: string | undefined =
            typeof result?.token === 'string' && result.token
              ? result.token
              : typeof result?.verifyToken === 'string' && result.verifyToken
              ? result.verifyToken
              : undefined;

          if (typeof window !== 'undefined' && t) {
            window.sessionStorage.setItem('order_verify_token', t);
          }
          setVerificationStatus('pending');
          setSubmitting(false);
          break;
        }
        case 'confirmed': {
          const orderId: string | undefined =
            typeof result?.orderId === 'string' ? result.orderId : undefined;
          if (orderId) {
            router.push(`/checkout/success?orderId=${encodeURIComponent(orderId)}`);
            return;
          }
          setFormError('Ordine confermato ma senza identificativo valido. Contatta il supporto.');
          setSubmitting(false);
          break;
        }
        case 'paid_redirect': {
          const url: string | undefined = typeof result?.url === 'string' ? result.url : undefined;
          if (url) {
            window.location.href = url;
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
    } catch {
      setFormError('Si è verificato un errore imprevisto. Controlla la connessione e riprova.');
      setSubmitting(false);
    }
  };

  const isSubmitDisabled = submitting || verificationStatus === 'pending';

  return (
    <div className="bg-white">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 lg:flex-row lg:px-8">
        {/* Form */}
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
                  onChange={(e) => setFormValues((p) => ({ ...p, email: e.target.value }))}
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
                  onChange={(e) => setFormValues((p) => ({ ...p, name: e.target.value }))}
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
                  onChange={(e) => setFormValues((p) => ({ ...p, phone: e.target.value }))}
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
                  onChange={(e) => setFormValues((p) => ({ ...p, notes: e.target.value }))}
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
                  onChange={(e) => setFormValues((p) => ({ ...p, agreePrivacy: e.target.checked }))}
                  required
                />
                <span className="text-sm text-slate-700">
                  Ho letto e accetto l’informativa privacy (obbligatorio).
                </span>
              </label>

              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  checked={formValues.agreeMarketing}
                  onChange={(e) => setFormValues((p) => ({ ...p, agreeMarketing: e.target.checked }))}
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
                  Ti abbiamo inviato una mail di verifica. Controlla la casella di posta e segui il link per completare l’ordine.
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
                  Grazie! Puoi completare il checkout confermando nuovamente l’ordine.
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
              {submitting
                ? 'Invio in corso…'
                : verificationStatus === 'pending'
                ? 'In attesa di verifica…'
                : 'Conferma ordine'}
            </button>
          </form>
        </div>

        {/* Riepilogo */}
        <aside className="w-full lg:w-1/3">
          <div className="rounded-lg border border-slate-200 bg-slate-50 p-6">
            <h2 className="text-lg font-semibold text-slate-900">Il tuo ordine</h2>
            <p className="mt-1 text-sm text-slate-600">{summaryDescription}</p>

            <div className="mt-6 space-y-4">
              {cartItems.length === 0 && !loading ? (
                <p className="text-sm text-slate-500">Nessun articolo nel carrello.</p>
              ) : (
                cartItems.map((item) => (
                  <div
                    key={item?.id ?? `${itemProductId(item) ?? 'p'}-${itemQty(item)}`}
                    className="flex items-start justify-between gap-4 border-b border-slate-200 pb-4 last:border-b-0 last:pb-0"
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-900">{itemName(item)}</p>
                      <p className="text-xs text-slate-500">Quantità: {itemQty(item)}</p>
                    </div>
                    {/* Se servisse, qui si può mostrare prezzo riga solo se disponibile nel DTO */}
                  </div>
                ))
              )}
            </div>

            <div className="mt-6 flex items-center justify-between border-t border-slate-200 pt-4">
              <span className="text-sm font-medium text-slate-700">Totale</span>
              <span className="text-lg font-semibold text-slate-900">
                {formatCurrency((totalCents ?? 0) / 100)}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
