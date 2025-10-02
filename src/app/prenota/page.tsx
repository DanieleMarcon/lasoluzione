'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({
  date: z.string().min(1, 'Seleziona una data'),
  time: z.string().min(1, 'Seleziona un orario'),
  people: z.coerce.number().int().min(1, 'Almeno 1 persona').max(20, 'Max 20 persone'),
  name: z.string().min(2, 'Inserisci il tuo nome'),
  email: z.string().email('Email non valida'),
  phone: z.string().optional(),
  notes: z.string().max(500, 'Max 500 caratteri').optional(),
  privacy: z.literal(true, { errorMap: () => ({ message: 'Devi accettare la privacy' }) }),
  hp: z.string().max(0).optional(), // honeypot anti-bot (nascosto)
});

type FormValues = z.infer<typeof schema>;

export default function PrenotaPage() {
  const [sent, setSent] = useState<null | FormValues>(null);

  const { register, handleSubmit, formState: { errors, isSubmitting }, reset } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      people: 2,
    },
  });

  const onSubmit = async (data: FormValues) => {
    // Qui integri un backend/email service. Per ora log + conferma UI.
    console.log('Richiesta prenotazione:', data);
    setSent(data);
    reset({ people: 2 });
  };

  return (
    <main className="container" style={{ padding: '2rem 1rem', maxWidth: 720, margin: '0 auto' }}>
      <h1 style={{ color: '#112f4d', textAlign: 'center' }}>Prenota un tavolo</h1>
      <p style={{ textAlign: 'center', marginBottom: 24 }}>
        Scegli data, orario e numero di persone. Ti risponderemo per confermare.
      </p>

      {sent ? (
        <SuccessPanel data={sent} onReset={() => setSent(null)} />
      ) : (
        <form onSubmit={handleSubmit(onSubmit)} noValidate style={{ display: 'grid', gap: 16 }}>
          {/* Honeypot (nascosto) */}
          <input type="text" tabIndex={-1} autoComplete="off" aria-hidden="true" style={{ position: 'absolute', left: '-9999px' }} {...register('hp')} />

          <div style={{ display: 'grid', gap: 12, gridTemplateColumns: '1fr 1fr' }}>
            <Field label="Data" error={errors.date?.message}>
              <input type="date" {...register('date')} />
            </Field>

            <Field label="Orario" error={errors.time?.message}>
              <input type="time" {...register('time')} />
            </Field>
          </div>

          <Field label="Persone" error={errors.people?.message}>
            <input type="number" min={1} max={20} {...register('people', { valueAsNumber: true })} />
          </Field>

          <Field label="Nome e cognome" error={errors.name?.message}>
            <input type="text" placeholder="Mario Rossi" {...register('name')} />
          </Field>

          <Field label="Email" error={errors.email?.message}>
            <input type="email" placeholder="mario@esempio.it" {...register('email')} />
          </Field>

          <Field label="Telefono (opzionale)" error={errors.phone?.message}>
            <input type="tel" placeholder="+39 ..." {...register('phone')} />
          </Field>

          <Field label="Note (opzionale)" error={errors.notes?.message}>
            <textarea rows={4} placeholder="Allergie, preferenze tavolo, ecc." {...register('notes')} />
          </Field>

          <label style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <input type="checkbox" {...register('privacy')} />
            <span>
              Ho letto e accetto la <a href="/privacy">privacy policy</a>.
              {errors.privacy?.message && (
                <div style={{ color: '#b91c1c', fontSize: 12 }}>{errors.privacy.message}</div>
              )}
            </span>
          </label>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{ background: '#112f4d', color: '#fff', borderRadius: 8, padding: '10px 16px', border: 0 }}
            >
              {isSubmitting ? 'Invio…' : 'Invia richiesta'}
            </button>
            <button type="button" onClick={() => reset({ people: 2 })} className="btn">
              Annulla
            </button>
          </div>
        </form>
      )}
    </main>
  );
}

/* ---------- UI helpers ---------- */

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={{ display: 'grid', gap: 6 }}>
        <span style={{ fontWeight: 600 }}>{label}</span>
        {children}
      </label>
      {error ? <div style={{ color: '#b91c1c', fontSize: 12, marginTop: 6 }}>{error}</div> : null}
      <style jsx>{`
        input, textarea, select {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 10px;
          width: 100%;
        }
        input:focus, textarea:focus, select:focus {
          outline: 2px solid #112f4d;
          outline-offset: 1px;
        }
      `}</style>
    </div>
  );
}

function SuccessPanel({ data, onReset }: { data: any; onReset: () => void }) {
  return (
    <div style={{
      border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, background: '#f8fafc',
      display: 'grid', gap: 12
    }}>
      <h2 style={{ margin: 0, color: '#112f4d' }}>Richiesta inviata ✅</h2>
      <p>Ti contatteremo a breve per confermare la prenotazione.</p>
      <details>
        <summary>Dettaglio richiesta</summary>
        <pre style={{ margin: 0, overflow: 'auto' }}>{JSON.stringify(data, null, 2)}</pre>
      </details>
      <div>
        <button onClick={onReset} className="btn">Nuova prenotazione</button>
      </div>
    </div>
  );
}
