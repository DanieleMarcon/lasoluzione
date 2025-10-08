'use client';

import Link from 'next/link';
import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import * as z from 'zod';

import { ToastProvider, useToast } from '@/components/admin/ui/toast';
import CheckoutButton from '@/components/cart/CheckoutButton';
import { useCart } from '@/hooks/useCart';
import { formatCurrency } from '@/lib/formatCurrency';
import type { OrderDTO } from '@/types/order';

export const customerSchema = z.object({
  name: z.string().min(2, 'Nome obbligatorio'),
  email: z.string().email('Email non valida'),
  phone: z
    .string()
    .min(7, 'Telefono obbligatorio')
    .regex(/^[0-9+()\s.-]{7,}$/, 'Telefono non valido'),
  notes: z.string().optional(),
});

type FormState = {
  email: string;
  name: string;
  phone: string;
  notes: string;
};

const INITIAL_FORM_STATE: FormState = {
  email: '',
  name: '',
  phone: '',
  notes: '',
};

type OrderView = 'idle' | 'confirmed' | 'pending';

type CheckoutSession = {
  paymentRef: string;
  checkoutPublicId?: string | null;
  hostedPaymentUrl?: string | null;
};

function CheckoutContent() {
  const { cart, cartToken, loading, error } = useCart();
  const toast = useToast();
  const [formState, setFormState] = useState<FormState>(INITIAL_FORM_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [order, setOrder] = useState<OrderDTO | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [checkoutSession, setCheckoutSession] = useState<CheckoutSession | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);

  const items = cart?.items ?? [];
  const hasItems = items.length > 0;
  const totalCents = cart?.totalCents ?? 0;

  const view: OrderView = order
    ? order.status === 'confirmed' || order.status === 'paid'
      ? 'confirmed'
      : 'pending'
    : 'idle';

  const summaryDescription = useMemo(() => {
    if (loading) return 'Caricamento del carrello in corso…';
    if (error) return 'Impossibile caricare il carrello.';
    if (!hasItems) return 'Il carrello è vuoto. Torna al catalogo per aggiungere prodotti.';
    return 'Controlla i dettagli dell’ordine prima di completare il checkout.';
  }, [loading, error, hasItems]);

  const handleInputChange =
    (field: keyof FormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const value = event.target.value;
      setFormState((prev) => ({ ...prev, [field]: value }));
      if (field === 'phone' && phoneError) {
        setPhoneError(null);
      }
    };

  const prepareCheckout = async (nextOrderId: string) => {
    setCheckoutSession(null);
    setCheckoutLoading(true);
    setCheckoutError(null);
    setWarnings([]);

    try {
      const res = await fetch('/api/payments/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: nextOrderId }),
      });

      const body = (await res.json().catch(() => null)) as
        | {
            ok?: boolean;
            data?: {
              paymentRef?: string;
              checkoutPublicId?: string | null;
              hostedPaymentUrl?: string | null;
              redirectUrl?: string | null;
              email?: { ok: boolean; skipped?: boolean; error?: string } | null;
              configWarning?: string | null;
            };
            error?: string;
          }
        | null;

      if (!res.ok || !body?.ok || !body.data) {
        throw new Error(body?.error || 'Impossibile avviare il pagamento.');
      }

      if (body.data.redirectUrl) {
        window.location.href = body.data.redirectUrl;
        return;
      }

      if (!body.data.paymentRef) {
        throw new Error('Riferimento pagamento non disponibile.');
      }

      const nextWarnings: string[] = [];
      const emailResult = body.data.email;
      if (emailResult && (!emailResult.ok || emailResult.skipped)) {
        nextWarnings.push(
          'Non siamo riusciti a inviare l’email automatica. Puoi completare il pagamento direttamente da qui.'
        );
      }
      if (body.data.configWarning) {
        nextWarnings.push(body.data.configWarning);
      }
      setWarnings(nextWarnings);

      setCheckoutSession({
        paymentRef: body.data.paymentRef,
        checkoutPublicId: body.data.checkoutPublicId ?? null,
        hostedPaymentUrl: body.data.hostedPaymentUrl ?? null,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Impossibile avviare il pagamento. Riprova più tardi.';
      setCheckoutError(message);
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!cartToken) {
      toast.error('Carrello non disponibile. Riprova più tardi.');
      return;
    }
    if (!hasItems) {
      toast.error('Il carrello è vuoto.');
      return;
    }

    const trimmedEmail = formState.email.trim();
    const trimmedName = formState.name.trim();
    const trimmedPhone = formState.phone.trim();
    const trimmedNotes = formState.notes.trim();

    const validated = customerSchema.safeParse({
      email: trimmedEmail,
      name: trimmedName,
      phone: trimmedPhone,
      notes: trimmedNotes ? trimmedNotes : undefined,
    });

    if (!validated.success) {
      const flat = validated.error.flatten();
      const phoneIssue = flat.fieldErrors.phone?.[0];
      if (phoneIssue) {
        setPhoneError(phoneIssue);
      }
      const generalError =
        phoneIssue || flat.fieldErrors.email?.[0] || flat.fieldErrors.name?.[0] || flat.formErrors[0] || 'Dati non validi.';
      toast.error(generalError);
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: cartToken,
          email: validated.data.email,
          name: validated.data.name,
          phone: validated.data.phone,
          notes: validated.data.notes,
        }),
      });

      const body = (await res.json().catch(() => null)) as
        | { ok: boolean; data?: OrderDTO; error?: string }
        | null;

      if (!res.ok || !body?.ok || !body.data) {
        toast.error(body?.error || 'Impossibile completare il checkout.');
        return;
      }

      setOrder(body.data);
      setPhoneError(null);
      await prepareCheckout(body.data.id);
    } catch (err) {
      console.error('[Checkout] submit error', err);
      toast.error('Errore di rete durante il checkout.');
    } finally {
      setSubmitting(false);
    }
  };

  if (view === 'confirmed' && order) {
    return (
      <div
        className="container"
        style={{ padding: '2rem 1rem', maxWidth: 640, margin: '0 auto', textAlign: 'center' }}
      >
        <h1 style={{ color: '#14532d' }}>Ordine confermato</h1>
        <p style={{ fontSize: '1.1rem', color: '#0f172a' }}>
          Il tuo ordine a costo zero è stato confermato automaticamente.
        </p>
        <p style={{ color: '#475569' }}>
          Riceverai una conferma via email all’indirizzo {formState.email.trim()}.
        </p>
        <div style={{ marginTop: '2rem' }}>
          <Link
            href="/"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              borderRadius: 999,
              backgroundColor: '#0f172a',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Torna alla home
          </Link>
        </div>
      </div>
    );
  }

  if (view === 'pending' && order) {
    return (
      <div
        className="container"
        style={{ padding: '2rem 1rem', maxWidth: 640, margin: '0 auto', textAlign: 'center' }}
      >
        <h1 style={{ color: '#0f172a', marginBottom: '0.5rem' }}>Completa il pagamento</h1>
        <p style={{ fontSize: '1.05rem', color: '#334155' }}>
          Ordine <strong>#{order.id}</strong> creato correttamente. Premi il pulsante per aprire il checkout Revolut e
          finalizzare il pagamento di {formatCurrency(order.totalCents)}.
        </p>

        <div style={{ margin: '2rem auto 0', maxWidth: 320, display: 'grid', gap: '0.75rem' }}>
          {checkoutLoading && (
            <div className="text-muted" role="status">
              Preparazione del pagamento in corso…
            </div>
          )}

          {warnings.map((warning) => (
            <div key={warning} className="alert alert-warning" role="status" style={{ margin: 0 }}>
              {warning}
            </div>
          ))}

          {checkoutError && (
            <div className="alert alert-danger" role="alert" style={{ margin: 0 }}>
              {checkoutError}
            </div>
          )}

          {checkoutSession ? (
            <CheckoutButton
              paymentRef={checkoutSession.paymentRef}
              token={checkoutSession.checkoutPublicId}
              hostedPaymentUrl={checkoutSession.hostedPaymentUrl}
              disabled={checkoutLoading}
            />
          ) : (
            !checkoutLoading && !checkoutError && (
              <p className="text-muted" style={{ margin: 0 }}>
                Stiamo preparando il collegamento al pagamento…
              </p>
            )
          )}
        </div>

        <p style={{ marginTop: '1.5rem', color: '#64748b' }}>
          Una volta completata la transazione verrai reindirizzato alla pagina di conferma. Se chiudi la finestra puoi
          sempre riprendere il pagamento dal link ricevuto via email.
        </p>

        <div style={{ marginTop: '2rem' }}>
          <Link
            href="/prenota"
            style={{
              display: 'inline-block',
              padding: '0.75rem 1.5rem',
              borderRadius: 999,
              backgroundColor: '#1e293b',
              color: '#fff',
              textDecoration: 'none',
              fontWeight: 600,
            }}
          >
            Torna alle prenotazioni
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container" style={{ padding: '2rem 1rem', maxWidth: 960, margin: '0 auto' }}>
      <header style={{ marginBottom: '2rem', textAlign: 'center' }}>
        <h1 style={{ color: '#0f172a', marginBottom: 8 }}>Checkout</h1>
        <p style={{ margin: 0, color: '#475569' }}>{summaryDescription}</p>
      </header>

      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '2rem',
          alignItems: 'flex-start',
        }}
      >
        <section style={{ flex: '1 1 360px', minWidth: 0 }}>
          <div
            style={{
              border: '1px solid #e2e8f0',
              borderRadius: 16,
              padding: '1.5rem',
              backgroundColor: '#f8fafc',
              display: 'grid',
              gap: '1rem',
            }}
          >
            <h2 style={{ margin: 0, fontSize: '1.125rem', color: '#0f172a' }}>Riepilogo ordine</h2>
            {loading ? (
              <p style={{ margin: 0, color: '#475569' }}>Caricamento in corso…</p>
            ) : error ? (
              <p style={{ margin: 0, color: '#b91c1c' }}>Errore nel caricamento del carrello.</p>
            ) : hasItems ? (
              <>
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.75rem' }}>
                  {items.map((item) => (
                    <li key={item.id} style={{ display: 'flex', justifyContent: 'space-between', gap: '0.75rem' }}>
                      <div>
                        <strong style={{ display: 'block', color: '#0f172a' }}>{item.nameSnapshot}</strong>
                        <span style={{ color: '#64748b' }}>x {item.qty}</span>
                      </div>
                      <span style={{ color: '#0f172a', fontWeight: 600 }}>
                        {formatCurrency(item.priceCentsSnapshot * item.qty)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid #e2e8f0',
                    paddingTop: '0.75rem',
                    fontWeight: 600,
                    color: '#0f172a',
                  }}
                >
                  <span>Totale</span>
                  <span>{formatCurrency(totalCents)}</span>
                </div>
              </>
            ) : (
              <p style={{ margin: 0, color: '#475569' }}>Nessun prodotto nel carrello.</p>
            )}
          </div>
        </section>

        <section style={{ flex: '1 1 360px', minWidth: 0 }}>
          <form
            onSubmit={handleSubmit}
            noValidate
            style={{ display: 'grid', gap: '1rem', border: '1px solid #e2e8f0', borderRadius: 16, padding: '1.5rem' }}
          >
            <h2 style={{ margin: 0, fontSize: '1.125rem', color: '#0f172a' }}>Dati di contatto</h2>
            <label style={{ display: 'grid', gap: '0.25rem', color: '#0f172a', fontWeight: 600 }}>
              Email
              <input
                type="email"
                required
                value={formState.email}
                onChange={handleInputChange('email')}
                placeholder="nome@example.com"
                style={{
                  padding: '0.65rem 0.75rem',
                  borderRadius: 12,
                  border: '1px solid #cbd5f5',
                  fontSize: '1rem',
                }}
              />
            </label>
            <label style={{ display: 'grid', gap: '0.25rem', color: '#0f172a', fontWeight: 600 }}>
              Nome e cognome
              <input
                type="text"
                required
                value={formState.name}
                onChange={handleInputChange('name')}
                placeholder="Mario Rossi"
                style={{
                  padding: '0.65rem 0.75rem',
                  borderRadius: 12,
                  border: '1px solid #cbd5f5',
                  fontSize: '1rem',
                }}
              />
            </label>
            <label style={{ display: 'grid', gap: '0.25rem', color: '#0f172a', fontWeight: 600 }}>
              Telefono
              <input
                type="tel"
                value={formState.phone}
                onChange={handleInputChange('phone')}
                placeholder="Numero di telefono"
                required
                aria-invalid={Boolean(phoneError)}
                aria-describedby="checkout-phone-error"
                style={{
                  padding: '0.65rem 0.75rem',
                  borderRadius: 12,
                  border: phoneError ? '1px solid #dc2626' : '1px solid #cbd5f5',
                  fontSize: '1rem',
                }}
              />
              {phoneError && (
                <span
                  id="checkout-phone-error"
                  role="alert"
                  style={{ color: '#b91c1c', fontSize: '0.9rem' }}
                >
                  {phoneError}
                </span>
              )}
            </label>
            <label style={{ display: 'grid', gap: '0.25rem', color: '#0f172a', fontWeight: 600 }}>
              Note
              <textarea
                value={formState.notes}
                onChange={handleInputChange('notes')}
                rows={4}
                placeholder="Indicazioni aggiuntive"
                style={{
                  padding: '0.65rem 0.75rem',
                  borderRadius: 12,
                  border: '1px solid #cbd5f5',
                  fontSize: '1rem',
                  resize: 'vertical',
                }}
              />
            </label>
            <button
              type="submit"
              disabled={submitting || !hasItems || loading || Boolean(error)}
              style={{
                padding: '0.85rem 1.25rem',
                borderRadius: 999,
                border: 'none',
                backgroundColor:
                  submitting || loading
                    ? '#94a3b8'
                    : !hasItems || Boolean(error)
                    ? '#94a3b8'
                    : '#2563eb',
                color: '#fff',
                fontWeight: 600,
                cursor:
                  submitting || !hasItems || loading || Boolean(error) ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s ease',
              }}
            >
              {submitting ? 'Invio in corso…' : 'Completa l’ordine'}
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

export default function CheckoutPage() {
  return (
    <ToastProvider>
      <CheckoutContent />
    </ToastProvider>
  );
}
