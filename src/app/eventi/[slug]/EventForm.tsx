'use client';

import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type FieldErrors = Partial<{
  name: string;
  email: string;
  phone: string;
  people: string;
  agreePrivacy: string;
  submit: string;
}>;

type EventTierOption = {
  id: number;
  label: string;
  priceCents: number;
};

interface EventFormProps {
  eventSlug: string;
  tiers?: EventTierOption[];
}

interface FormState {
  name: string;
  email: string;
  phone: string;
  people: string;
  notes: string;
  tierId: string;
  agreePrivacy: boolean;
  agreeMarketing: boolean;
}

const INITIAL_STATE: FormState = {
  name: '',
  email: '',
  phone: '',
  people: '1',
  notes: '',
  tierId: '',
  agreePrivacy: false,
  agreeMarketing: false,
};

function validateEmail(value: string): boolean {
  return /.+@.+\..+/.test(value);
}

function parsePeople(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 0;
  return parsed;
}

function formatMoney(cents: number): string {
  return (cents / 100).toLocaleString('it-IT', {
    style: 'currency',
    currency: 'EUR',
  });
}

export default function EventForm({ eventSlug, tiers }: EventFormProps) {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const peopleValue = useMemo(() => parsePeople(formState.people), [formState.people]);

  const handleChange = (field: keyof FormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value =
        event.target.type === 'checkbox'
          ? (event.target as HTMLInputElement).checked
          : event.target.value;
      setFormState((prev) => ({
        ...prev,
        [field]: value,
      }));
    };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextErrors: FieldErrors = {};
    const trimmedName = formState.name.trim();
    const trimmedEmail = formState.email.trim();
    const trimmedPhone = formState.phone.trim();
    const trimmedNotes = formState.notes.trim();
    const trimmedTierId = formState.tierId.trim();
    const parsedTierIdValue = Number.parseInt(trimmedTierId, 10);
    const parsedTierId =
      trimmedTierId.length && Number.isFinite(parsedTierIdValue) ? parsedTierIdValue : undefined;

    if (!trimmedName) {
      nextErrors.name = 'Inserisci il tuo nome e cognome.';
    }

    if (!validateEmail(trimmedEmail)) {
      nextErrors.email = 'Inserisci un indirizzo email valido.';
    }

    if (!trimmedPhone) {
      nextErrors.phone = 'Inserisci un numero di telefono valido.';
    }

    if (peopleValue < 1) {
      nextErrors.people = 'Indica il numero di persone (almeno 1).';
    }

    if (!formState.agreePrivacy) {
      nextErrors.agreePrivacy = 'Devi accettare la privacy per inviare la richiesta.';
    }

    setErrors(nextErrors);

    if (Object.keys(nextErrors).length > 0) {
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch('/api/bookings/email-only', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          eventSlug,
          name: trimmedName,
          email: trimmedEmail,
          phone: trimmedPhone,
          people: peopleValue,
          notes: trimmedNotes.length ? trimmedNotes : undefined,
          tierId: parsedTierId,
          agreePrivacy: formState.agreePrivacy,
          agreeMarketing: formState.agreeMarketing,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | {
            bookingId?: string;
          }
        | null;

      if (response.ok && data?.bookingId) {
        router.push(`/checkout/email-sent?bookingId=${encodeURIComponent(data.bookingId)}`);
        return;
      }

      setErrors({
        submit:
          'Impossibile inviare la richiesta di prenotazione. Controlla i dati o riprova tra qualche istante.',
      });
    } catch (error) {
      console.error('[EventForm] submit error', error);
      setErrors({ submit: 'Errore di rete durante l’invio. Riprova tra poco.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit} noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="event-name">
            Nome e cognome*
          </label>
          <input
            id="event-name"
            name="name"
            type="text"
            autoComplete="name"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            value={formState.name}
            onChange={handleChange('name')}
            disabled={submitting}
            required
          />
          {errors.name ? <p className="mt-1 text-sm text-red-600">{errors.name}</p> : null}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="event-email">
            Email*
          </label>
          <input
            id="event-email"
            name="email"
            type="email"
            autoComplete="email"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            value={formState.email}
            onChange={handleChange('email')}
            disabled={submitting}
            required
          />
          {errors.email ? <p className="mt-1 text-sm text-red-600">{errors.email}</p> : null}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="event-phone">
            Telefono*
          </label>
          <input
            id="event-phone"
            name="phone"
            type="tel"
            autoComplete="tel"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            value={formState.phone}
            onChange={handleChange('phone')}
            disabled={submitting}
            required
          />
          {errors.phone ? <p className="mt-1 text-sm text-red-600">{errors.phone}</p> : null}
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="event-people">
            Persone*
          </label>
          <input
            id="event-people"
            name="people"
            type="number"
            min={1}
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            value={formState.people}
            onChange={handleChange('people')}
            disabled={submitting}
            required
          />
          {errors.people ? <p className="mt-1 text-sm text-red-600">{errors.people}</p> : null}
        </div>
      </div>

      {tiers && tiers.length > 0 ? (
        <div>
          <label className="block text-sm font-medium text-gray-700" htmlFor="event-tier">
            Pacchetto (opzionale)
          </label>
          <select
            id="event-tier"
            name="tierId"
            className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            value={formState.tierId}
            onChange={handleChange('tierId')}
            disabled={submitting}
          >
            <option value="">Seleziona un pacchetto</option>
            {tiers.map((tier) => (
              <option key={tier.id} value={tier.id}>
                {`${tier.label} (${formatMoney(tier.priceCents)})`}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div>
        <label className="block text-sm font-medium text-gray-700" htmlFor="event-notes">
          Note
        </label>
        <textarea
          id="event-notes"
          name="notes"
          rows={4}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
          value={formState.notes}
          onChange={handleChange('notes')}
          disabled={submitting}
        />
      </div>

      <div className="space-y-3">
        <label className="flex items-start gap-2 text-sm text-gray-700" htmlFor="event-privacy">
          <input
            id="event-privacy"
            name="agreePrivacy"
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            checked={formState.agreePrivacy}
            onChange={handleChange('agreePrivacy')}
            disabled={submitting}
            required
          />
          <span>Ho letto e accetto l’informativa sulla privacy*</span>
        </label>
        {errors.agreePrivacy ? <p className="text-sm text-red-600">{errors.agreePrivacy}</p> : null}

        <label className="flex items-start gap-2 text-sm text-gray-700" htmlFor="event-marketing">
          <input
            id="event-marketing"
            name="agreeMarketing"
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            checked={formState.agreeMarketing}
            onChange={handleChange('agreeMarketing')}
            disabled={submitting}
          />
          <span>Voglio ricevere aggiornamenti e promozioni via email</span>
        </label>
      </div>

      {errors.submit ? <p className="text-sm text-red-600">{errors.submit}</p> : null}

      <button
        type="submit"
        className="inline-flex w-full items-center justify-center rounded-md bg-primary-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-primary-300"
        disabled={submitting}
      >
        {submitting ? 'Invio in corso…' : 'Prenota senza pagare'}
      </button>
    </form>
  );
}
