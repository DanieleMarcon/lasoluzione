'use client';

import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { bookingSchema } from './validation';
import Step1Date from './steps/Step1Date';
import Step2People from './steps/Step2People';
import Step3Details from './steps/Step3Details';
import Step4Review from './steps/Step4Review';

// -----------------------------
// Tipi “da form” (semplici)
// -----------------------------
type BookingType = 'pranzo' | 'aperitivo' | 'evento';
type Step = 1 | 2 | 3 | 4;

type FormValues = {
  date: string;        // "YYYY-MM-DD"
  time: string;        // "HH:mm"
  people: number;
  type: BookingType;
  name: string;
  email: string;
  phone: string;       // obbligatorio
  notes?: string;
  agreePrivacy: boolean;
  agreeMarketing?: boolean;
};

// campi da validare per ogni step
const STEP_FIELDS: Record<Step, (keyof FormValues)[]> = {
  1: ['date', 'time'],
  2: ['people', 'type'],
  3: ['name', 'email', 'phone', 'notes'],
  4: ['agreePrivacy'], // il check privacy è nello step finale
};

// Progress bar
const steps: Array<{ id: Step; label: string }> = [
  { id: 1, label: 'Data & orario' },
  { id: 2, label: 'Persone & tipologia' },
  { id: 3, label: 'Dettagli' },
  { id: 4, label: 'Riepilogo' },
];

export default function BookingWizard() {
  const [step, setStep] = useState<Step>(1);

  const methods = useForm<FormValues>({
    resolver: zodResolver(bookingSchema),
    mode: 'onChange',
    shouldUnregister: false, // conserva i valori degli step precedenti
    defaultValues: {
      date: '',
      time: '',
      people: 2,
      type: 'pranzo',
      name: '',
      email: '',
      phone: '',
      notes: '',
      agreePrivacy: false,
      agreeMarketing: false,
    },
  });

  const next = async () => {
    // ✅ valida solo i campi dello step corrente
    const valid = await methods.trigger(STEP_FIELDS[step], { shouldFocus: true });
    if (valid) setStep(prev => (Math.min(4, (prev + 1) as Step) as Step));
  };

  const back = () => setStep(prev => (Math.max(1, (prev - 1) as Step) as Step));

  // Submit finale
  const onSubmit = async (data: FormValues) => {
    const payload = {
      ...data,
      phone: data.phone.trim(),
      notes: data.notes && data.notes.trim().length ? data.notes.trim() : undefined,
    };

    try {
      const res = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error('Booking error:', err);
        alert('Errore nell’invio della prenotazione.\n' + (err?.error || res.status));
        return;
      }

      const out = await res.json();
      alert(`Richiesta inviata! Codice prenotazione #${out.bookingId}`);
      methods.reset();
      setStep(1);
    } catch (e) {
      console.error(e);
      alert('Errore di rete. Riprova più tardi.');
    }
  };

  return (
    <section aria-labelledby="booking-flow">
      <h2 id="booking-flow" className="visually-hidden">Prenotazione</h2>

      {/* Stepper */}
      <ol
        aria-label="Passaggi prenotazione"
        style={{ display: 'flex', gap: '.5rem', listStyle: 'none', padding: 0 }}
      >
        {steps.map(s => (
          <li
            key={s.id}
            aria-current={step === s.id ? 'step' : undefined}
            style={{
              padding: '.5rem .75rem',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              background: step === s.id ? 'var(--color-border)' : 'transparent',
            }}
          >
            {s.id}. {s.label}
          </li>
        ))}
      </ol>

      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSubmit)} aria-live="assertive">
          {step === 1 && <Step1Date />}
          {step === 2 && <Step2People />}
          {step === 3 && <Step3Details />}
          {step === 4 && <Step4Review />}

          <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem' }}>
            <button className="btn" type="button" onClick={back} disabled={step === 1}>
              Indietro
            </button>

            {step < 4 ? (
              <button className="btn" type="button" onClick={next}>
                Avanti
              </button>
            ) : (
              <button className="btn" type="submit">
                Conferma richiesta
              </button>
            )}
          </div>
        </form>
      </FormProvider>
    </section>
  );
}
