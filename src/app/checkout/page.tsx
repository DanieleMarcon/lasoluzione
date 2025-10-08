'use client';

import Link from 'next/link';
import { useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import RevolutCheckout from '@revolut/checkout';

import { ToastProvider, useToast } from '@/components/admin/ui/toast';
import { useCart } from '@/hooks/useCart';
import { formatCurrency } from '@/lib/formatCurrency';
import { customerSchema } from './schema';

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

type OrderView = 'idle' | 'pending_payment';

function CheckoutContent() {
  const router = useRouter();
  const { cart, cartToken, loading, error, clearCartToken, refresh } = useCart();
  const toast = useToast();
  const [formState, setFormState] = useState<FormState>(INITIAL_FORM_STATE);
  const [submitting, setSubmitting] = useState(false);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [orderView, setOrderView] = useState<OrderView>('idle');
  const [orderInfo, setOrderInfo] = useState<{ orderId: string; totalCents: number } | null>(null);
  const [revolutToken, setRevolutToken] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);
  const [revolutLoading, setRevolutLoading] = useState(false);

  const items = cart?.items ?? [];
  const hasItems = items.length > 0;
  const totalCents = cart?.totalCents ?? 0;

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

  const clearClientCart = async () => {
    try {
      clearCartToken();
      await refresh();
    } catch (err) {
      console.error('[Checkout] unable to refresh cart after payment', err);
    }
  };

  const navigateToSuccess = (orderId: string) => {
    router.push(`/checkout/success?orderId=${encodeURIComponent(orderId)}`);
  };

  const pollOrderStatus = async (orderId: string) => {
    const maxAttempts = 8;
    for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
      try {
        const res = await fetch(`/api/payments/order-status?orderId=${encodeURIComponent(orderId)}`, {
          cache: 'no-store',
        });
        const body = (await res.json().catch(() => null)) as
          | { ok: boolean; data?: { status?: string } }
          | null;
        if (body?.ok && body.data?.status) {
          const status = body.data.status;
          if (status === 'paid' || status === 'completed') {
            return 'paid' as const;
          }
          if (status === 'failed' || status === 'cancelled' || status === 'declined') {
            return 'failed' as const;
          }
        }
      } catch (err) {
        console.error('[Checkout] polling status error', err);
      }
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
    return 'pending' as const;
  };

  const startRevolutCheckout = async (token: string, orderId: string) => {
    setRevolutLoading(true);
    setPaymentError(null);
    try {
      const publicToken = process.env.NEXT_PUBLIC_REVOLUT_PUBLIC_KEY;
      const mode = process.env.NEXT_PUBLIC_REVOLUT_ENV === 'prod' ? 'prod' : 'sandbox';

      // DEBUG: vedi che la chiave arrivi nel bundle client
      console.log('[Revolut] mode=%s public=%s', mode, publicToken ? publicToken.slice(0, 12) + '…' : 'MISSING');

      if (!publicToken) {
        throw new Error(
          'Missing Revolut public token. Aggiungi NEXT_PUBLIC_REVOLUT_PUBLIC_KEY al .env.local e riavvia il server.'
        );
      }

      // ✅ firma corretta: prima chiave pubblica, poi pay(token)
      const sdk = await RevolutCheckout(publicToken, { mode, locale: 'it' });
      await sdk.pay(token);

      const status = await pollOrderStatus(orderId);
      if (status === 'paid') {
        await clearClientCart();
        navigateToSuccess(orderId);
        return;
      }
      if (status === 'failed') {
        setPaymentError('Pagamento non completato. Puoi riprovare.');
        return;
      }
      setPaymentError('Pagamento in elaborazione. Controlla la posta o riprova fra poco.');
    } catch (err) {
      console.error('[Checkout] Revolut popup error', err);
      setPaymentError('Impossibile avviare il pagamento. Contatta il supporto o riprova.');
    } finally {
      setRevolutLoading(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!cartToken || !cart?.id) {
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

    if (!trimmedPhone) {
      setPhoneError('Telefono obbligatorio');
      toast.error('Inserisci un numero di telefono.');
      return;
    }

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
          cartId: cart.id,
          email: validated.data.email,
          name: validated.data.name,
          phone: validated.data.phone,
          notes: validated.data.notes,
        }),
      });

      const body = (await res.json().catch(() => null)) as
        | {
            ok: boolean;
            data?:
              | { orderId: string; status: 'paid' }
              | { orderId: string; status: 'pending_payment'; totalCents: number; revolutToken: string };
            error?: string;
          }
        | null;

      if (!res.ok || !body?.ok || !body.data) {
        toast.error(body?.error || 'Impossibile completare il checkout.');
        return;
      }

      setPhoneError(null);
      if (body.data.status === '
// 