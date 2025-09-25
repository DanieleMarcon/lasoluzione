'use client';
import { useForm, FormProvider } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { bookingSchema, type BookingData } from './validation';
import Step1Date from './steps/Step1Date';
import Step2People from './steps/Step2People';
import Step3Details from './steps/Step3Details';
import Step4Review from './steps/Step4Review';
import { useState } from 'react';

const steps = [
  { id: 1, label: 'Data & orario' },
  { id: 2, label: 'Persone & tipologia' },
  { id: 3, label: 'Dettagli' },
  { id: 4, label: 'Riepilogo' }
];

export default function BookingWizard() {
  const methods = useForm<BookingData>({
    resolver: zodResolver(bookingSchema),
    mode: 'onChange',
    defaultValues: { people: 2, type: 'pranzo', agreePrivacy: false, agreeMarketing: false }
  });
  const [step, setStep] = useState(1);
  const next = async () => { const valid = await methods.trigger(); if (valid) setStep((s)=>Math.min(4, s+1)); };
  const back = () => setStep((s)=>Math.max(1, s-1));
  const onSubmit = (data: BookingData) => { alert('Richiesta inviata!\n'+JSON.stringify(data,null,2)); };

  return (
    <section aria-labelledby="booking-flow">
      <h2 id="booking-flow" className="visually-hidden">Prenotazione</h2>
      <ol aria-label="Passaggi prenotazione" style={{ display:'flex', gap:'.5rem', listStyle:'none', padding:0 }}>
        {steps.map(s => (
          <li key={s.id} aria-current={step===s.id ? 'step' : undefined}
              style={{ padding:'.5rem .75rem', border:'1px solid var(--color-border)', borderRadius:'12px',
                       background: step===s.id ? 'var(--color-border)' : 'transparent' }}>
            {s.id}. {s.label}
          </li>
        ))}
      </ol>

      <FormProvider {...methods}>
        <form onSubmit={methods.handleSubmit(onSubmit)} aria-live="assertive">
          {step===1 && <Step1Date />}
          {step===2 && <Step2People />}
          {step===3 && <Step3Details />}
          {step===4 && <Step4Review />}

          <div style={{ display:'flex', gap:'.5rem', marginTop:'1rem' }}>
            <button className="btn" type="button" onClick={back} disabled={step===1}>Indietro</button>
            {step<4 ? <button className="btn" type="button" onClick={next}>Avanti</button>
                    : <button className="btn" type="submit">Conferma richiesta</button>}
          </div>
        </form>
      </FormProvider>
    </section>
  );
}