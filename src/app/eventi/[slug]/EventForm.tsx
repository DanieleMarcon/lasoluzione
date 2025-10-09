'use client';

import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

type FieldErrors = Partial<{
  name: string;
  email: string;
  phone: string;
  people: string;
  notes: string;
  agreePrivacy: string;
  submit: string;
}>;

interface EventFormProps {
  eventSlug: string;
  eventInstanceId?: number;
}

interface FormState {
  name: string;
  email: string;
  phone: string;
  people: string;
  notes: string;
  agreePrivacy: boolean;
  agreeMarketing: boolean;
}

const INITIAL_STATE: FormState = {
  name: '',
  email: '',
  phone: '',
  people: '1',
  notes: '',
  agreePrivacy: false,
  agreeMarketing: false,
};

function mapApiError(code: string | undefined): string {
  switch (code) {
    case 'event_not_found':
      return 'Evento non trovato. Riprova più tardi.';
    case 'email_only_not_allowed':
      return 'Per questo evento non è disponibile la prenotazione via email.';
    case 'invalid_payload':
      return 'Dati non validi. Controlla le informazioni inserite.';
    default:
      return 'Impossibile inviare la richiesta di prenotazione. Riprova tra qualche istante.';
  }
}

function validateEmail(value: string): boolean {
  return /.+@.+\..+/.test(value);
}

function parsePeople(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (Number.isNaN(parsed)) return 0;
  return parsed;
}

export default function EventForm({ eventSlug, eventInstanceId }: EventFormProps) {
  const router = useRouter();
  const [formState, setFormState] = useState<FormState>(INITIAL_STATE);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);

  const peopleValue = useMemo(() => parsePeople(formState.people), [formState.people]);

  const handleChange = (field: keyof FormState) =>
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
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

    if (trimmedName.length < 2) {
      nextErrors.name = 'Inserisci il tuo nome e cognome.';
    }

    if (!validateEmail(trimmedEmail)) {
      nextErrors.email = 'Inserisci un indirizzo email valido.';
    }

    if (trimmedPhone.length < 6) {
      nextErrors.phone = 'Inserisci un numero di telefono valido.';
    }

    if (peopleValue < 1) {
      nextErrors.people = 'Indica il numero di persone (almeno 1).';
    }

    if (!formState.agreePrivacy) {
      nextErrors.agreePrivacy = 'Devi accettare la privacy per inviare la richiesta.';
    }

    if (!eventInstanceId) {
      nextErrors.submit = 'Questo evento non è al momento disponibile.';
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
          eventInstanceId,
          people: peopleValue,
          notes: trimmedNotes.length ? trimmedNotes : undefined,
          agreePrivacy: formState.agreePrivacy,
          agreeMarketing: formState.agreeMarketing,
          customer: {
            name: trimmedName,
            email: trimmedEmail,
            phone: trimmedPhone,
          },
        }),
      });

      const body = (await response.json().catch(() => null)) as
        | {
            ok?: boolean;
            nextUrl?: string;
            error?: string;
          }
        | null;

      if (response.ok && body?.ok && body.nextUrl) {
        router.push(body.nextUrl);
        return;
      }

      const message = mapApiError(body?.error);
      setErrors({ submit: message });
    } catch (error) {
      console.error('[EventForm] submit error', error);
      setErrors({ submit: 'Errore di rete durante l’invio. Riprova tra poco.' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
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
        {errors.notes ? <p className="mt-1 text-sm text-red-600">{errors.notes}</p> : null}
      </div>

      <div className="space-y-3">
        <label className="flex items-start gap-2 text-sm text-gray-700">
          <input
            id="event-privacy"
            name="agreePrivacy"
            type="checkbox"
            className="mt-1 h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            checked={formState.agreePrivacy}
            onChange={handleChange('agreePrivacy')}
            disabled={submitting}
          />
          <span>
            Ho letto e accetto l’informativa sulla privacy*
          </span>
        </label>
        {errors.agreePrivacy ? <p className="text-sm text-red-600">{errors.agreePrivacy}</p> : null}

        <label className="flex items-start gap-2 text-sm text-gray-700">
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
