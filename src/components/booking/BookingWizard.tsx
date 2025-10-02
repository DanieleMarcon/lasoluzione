'use client';

import { useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { bookingSchema } from './validation';
import Step1Date from './steps/Step1Date';
import Step2People from './steps/Step2People';
import Step3Details from './steps/Step3Details';
import Step4Review from './steps/Step4Review';
import type { BookingConfigDTO } from '@/types/bookingConfig';

type BookingType = 'pranzo' | 'aperitivo' | 'evento';
type StepKey = 'dateTime' | 'peopleType' | 'details' | 'review';

type FormValues = {
  date: string;
  time: string;
  people: number;
  type: BookingType;
  name: string;
  email: string;
  phone: string;
  notes?: string;
  agreePrivacy: boolean;
  agreeMarketing?: boolean;
};

const STEP_FIELDS: Record<StepKey, (keyof FormValues)[]> = {
  dateTime: ['date', 'time'],
  peopleType: ['people', 'type'],
  details: ['name', 'email', 'phone', 'notes'],
  review: ['agreePrivacy'],
};

const BASE_STEPS: Array<{ key: StepKey; label: string }> = [
  { key: 'dateTime', label: 'Data & orario' },
  { key: 'peopleType', label: 'Persone & tipologia' },
  { key: 'details', label: 'Dettagli' },
  { key: 'review', label: 'Riepilogo' },
];

const DEFAULT_FORM_VALUES: FormValues = {
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
};

function buildResetValues(config: BookingConfigDTO | null): FormValues {
  const firstType = (config?.enabledTypes[0] as BookingType | undefined) ?? 'pranzo';
  return {
    ...DEFAULT_FORM_VALUES,
    date: config?.enableDateTimeStep === false ? config.fixedDate ?? '' : '',
    time: config?.enableDateTimeStep === false ? config.fixedTime ?? '' : '',
    type: firstType,
  };
}

export default function BookingWizard() {
  const [config, setConfig] = useState<BookingConfigDTO | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(true);
  const [configError, setConfigError] = useState<string | null>(null);
  const [stepIndex, setStepIndex] = useState(0);

  const methods = useForm<FormValues>({
    resolver: zodResolver(bookingSchema),
    mode: 'onChange',
    shouldUnregister: false,
    defaultValues: DEFAULT_FORM_VALUES,
  });

  useEffect(() => {
    let active = true;
    async function loadConfig() {
      try {
        const res = await fetch('/api/booking-config');
        if (!res.ok) {
          throw new Error(`Impostazioni non disponibili (${res.status})`);
        }
        const data = (await res.json()) as BookingConfigDTO;
        if (active) {
          setConfig(data);
          setConfigError(null);
        }
      } catch (err: any) {
        console.error('[BookingWizard] config error', err);
        if (active) {
          setConfigError('Impossibile caricare le impostazioni di prenotazione.');
        }
      } finally {
        if (active) setLoadingConfig(false);
      }
    }
    loadConfig();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!config) return;
    const defaults = buildResetValues(config);
    methods.reset(defaults);
    setStepIndex(0);
  }, [config, methods]);

  useEffect(() => {
    if (!config) return;
    if (config.enableDateTimeStep) return;
    if (config.fixedDate) {
      methods.setValue('date', config.fixedDate, { shouldValidate: true });
    }
    if (config.fixedTime) {
      methods.setValue('time', config.fixedTime, { shouldValidate: true });
    }
  }, [config, methods]);

  const activeSteps = useMemo(() => {
    if (!config) return BASE_STEPS;
    return BASE_STEPS.filter(step => (config.enableDateTimeStep ? true : step.key !== 'dateTime'));
  }, [config]);

  useEffect(() => {
    if (!config) return;
    const allowed = config.enabledTypes as BookingType[];
    if (allowed.length === 0) return;
    const current = methods.getValues('type');
    if (!allowed.includes(current)) {
      methods.setValue('type', allowed[0], { shouldValidate: true });
    }
  }, [config, methods]);

  const typeOptions = useMemo(
    () =>
      config
        ? config.enabledTypes.map(value => ({
            value,
            label: config.typeLabels[value] ?? value,
            requiresPrepay: config.prepayTypes.includes(value),
          }))
        : [],
    [config]
  );

  const currentStep = activeSteps[stepIndex] ?? activeSteps[0];

  const next = async () => {
    if (!currentStep) return;
    const valid = await methods.trigger(STEP_FIELDS[currentStep.key], { shouldFocus: true });
    if (valid && stepIndex < activeSteps.length - 1) {
      setStepIndex(prev => prev + 1);
    }
  };

  const back = () => {
    setStepIndex(prev => (prev > 0 ? prev - 1 : prev));
  };

  const onSubmit = async (data: FormValues) => {
    if (!config) {
      alert('Impostazioni non disponibili. Riprova più tardi.');
      return;
    }

    const payload = {
      ...data,
      phone: data.phone.trim(),
      notes: data.notes && data.notes.trim().length ? data.notes.trim() : undefined,
    };

    const requiresPrepay = config.prepayTypes.includes(payload.type);
    const endpoint = requiresPrepay ? '/api/bookings/prepay' : '/api/bookings';

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok || body?.ok === false) {
        if (body?.requiresPrepay && body?.message) {
          alert(body.message);
          return;
        }
        alert('Errore nell’invio della prenotazione.\n' + (body?.error || res.status));
        return;
      }

      if (requiresPrepay) {
        if (body.paymentUrl) {
          window.location.href = body.paymentUrl as string;
        } else {
          alert('Prenotazione registrata ma link di pagamento non disponibile.');
        }
        return;
      }

      alert(`Richiesta inviata! Codice prenotazione #${body.bookingId}`);
      methods.reset(buildResetValues(config));
      setStepIndex(0);
    } catch (error) {
      console.error('[BookingWizard] submit error', error);
      alert('Errore di rete. Riprova più tardi.');
    }
  };

  if (loadingConfig) {
    return <p>Caricamento impostazioni…</p>;
  }

  if (configError) {
    return <p>{configError}</p>;
  }

  if (!config) {
    return <p>Impostazioni non disponibili.</p>;
  }

  if (config.enabledTypes.length === 0) {
    return <p>Nessuna tipologia prenotabile al momento. Riprovare più tardi.</p>;
  }

  return (
    <section aria-labelledby="booking-flow">
      <h2 id="booking-flow" className="visually-hidden">
        Prenotazione
      </h2>

      <ol aria-label="Passaggi prenotazione" style={{ display: 'flex', gap: '.5rem', listStyle: 'none', padding: 0 }}>
        {activeSteps.map((s, index) => (
          <li
            key={s.key}
            aria-current={stepIndex === index ? 'step' : undefined}
            style={{
              padding: '.5rem .75rem',
              border: '1px solid var(--color-border)',
              borderRadius: '12px',
              background: stepIndex === index ? 'var(--color-border)' : 'transparent',
            }}
          >
            {index + 1}. {s.label}
          </li>
        ))}
      </ol>

      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSubmit)} aria-live="assertive">
          {currentStep?.key === 'dateTime' && <Step1Date />}
          {currentStep?.key === 'peopleType' && (
            <Step2People typeOptions={typeOptions} prepayAmountCents={config.prepayAmountCents} />
          )}
          {currentStep?.key === 'details' && <Step3Details />}
          {currentStep?.key === 'review' && <Step4Review config={config} />}

          <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem' }}>
            <button className="btn" type="button" onClick={back} disabled={stepIndex === 0}>
              Indietro
            </button>

            {stepIndex < activeSteps.length - 1 ? (
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
