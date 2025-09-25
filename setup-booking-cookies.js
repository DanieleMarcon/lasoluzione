const fs = require('fs');
const path = require('path');

const w = (p, c) => {
  const fp = path.join(process.cwd(), p);
  fs.mkdirSync(path.dirname(fp), { recursive: true });
  fs.writeFileSync(fp, c);
  console.log('• wrote', p);
};

const addImportsToLayout = () => {
  const p = 'src/app/(site)/layout.tsx';
  if (!fs.existsSync(p)) {
    console.warn('! layout.tsx non trovato a', p);
    return;
  }
  let s = fs.readFileSync(p, 'utf8');
  if (!/CookieBar/.test(s)) {
    // inserisci import vicino a ConsentScripts
    s = s.replace(
`ConsentScripts';`,
`ConsentScripts';
import CookieBar from '@/src/components/cookies/CookieBar';
import PreferencesModal from '@/src/components/cookies/PreferencesModal';`
    );
    // inserisci componenti prima di </body>
    s = s.replace(/\{children\}\s*<\/body>/, `{children}
        <CookieBar />
        <PreferencesModal />
      </body>`);
    fs.writeFileSync(p, s);
    console.log('• updated layout.tsx (CookieBar + PreferencesModal)');
  } else {
    console.log('• layout.tsx già integra CookieBar/PreferencesModal');
  }
};

const files = {
  'src/state/useCookieUI.ts': `
'use client';
import { create } from 'zustand';

type CookieUI = {
  isModalOpen: boolean;
  open: () => void;
  close: () => void;
};
export const useCookieUI = create<CookieUI>((set) => ({
  isModalOpen: false,
  open: () => set({ isModalOpen: true }),
  close: () => set({ isModalOpen: false })
}));
`.trim(),

  'src/components/cookies/FocusTrap.tsx': `
'use client';
import { useEffect, useRef } from 'react';

export default function FocusTrap({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const container = ref.current!;
    const els = container.querySelectorAll<HTMLElement>('a,button,input,select,textarea,[tabindex]:not([tabindex="-1"])');
    const first = els[0];
    const last = els[els.length - 1];
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Tab') {
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last?.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first?.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    first?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return <div ref={ref}>{children}</div>;
}
`.trim(),

  'src/components/cookies/CookieBar.tsx': `
'use client';
import { useEffect, useState } from 'react';
import { useConsentStore } from '@/src/state/useConsentStore';
import { useCookieUI } from '@/src/state/useCookieUI';

const POLICY = process.env.NEXT_PUBLIC_POLICY_VERSION || '1.0.0';

export default function CookieBar() {
  const { categories, policyVersion, set } = useConsentStore();
  const { open } = useCookieUI();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // mostra banner se manca timestamp o policy cambiata
    const st: any = useConsentStore.getState();
    setVisible(policyVersion !== POLICY || !('timestamp' in st) || !st.timestamp);
  }, [policyVersion]);

  if (!visible) return null;

  const acceptAll = () => {
    set({ policyVersion: POLICY, categories: { ...categories, functional: true, analytics: true, marketing: true }, timestamp: Date.now() });
    setVisible(false);
  };
  const rejectAll = () => {
    set({ policyVersion: POLICY, categories: { essential: true, functional: false, analytics: false, marketing: false }, timestamp: Date.now() });
    setVisible(false);
  };

  return (
    <div role="region" aria-label="Informativa cookie" style={{ position:'fixed', insetInline:0, bottom:0, background:'#fff', borderTop:'1px solid var(--color-border)', zIndex:1000 }}>
      <div className="container" style={{ padding:'1rem', display:'grid', gap:'.75rem' }}>
        <p>
          Usiamo cookie essenziali e, previo consenso, funzionali/analitici/marketing.
          <a href="/cookie-policy" style={{ marginInlineStart: '.5rem' }}>Dettagli cookie</a> ·
          <a href="/privacy" style={{ marginInlineStart: '.5rem' }}>Privacy</a>
        </p>
        <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
          <button className="btn" onClick={acceptAll}>Accetta tutto</button>
          <button className="btn" onClick={rejectAll} aria-label="Rifiuta tutti i cookie non essenziali">Rifiuta</button>
          <button className="btn" onClick={open} aria-haspopup="dialog" aria-controls="cookie-preferences">Preferenze</button>
        </div>
      </div>
    </div>
  );
}
`.trim(),

  'src/components/cookies/PreferencesModal.tsx': `
'use client';
import { useState } from 'react';
import { useConsentStore } from '@/src/state/useConsentStore';
import { useCookieUI } from '@/src/state/useCookieUI';
import FocusTrap from './FocusTrap';

const POLICY = process.env.NEXT_PUBLIC_POLICY_VERSION || '1.0.0';

export default function PreferencesModal() {
  const { isModalOpen, close } = useCookieUI();
  const { categories, set } = useConsentStore();
  const [local, setLocal] = useState({ ...categories });

  if (!isModalOpen) return null;

  const save = () => {
    set({ policyVersion: POLICY, categories: { ...local }, timestamp: Date.now() });
    close();
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="cookie-title" id="cookie-preferences"
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:1001, display:'grid', placeItems:'center' }}>
      <div style={{ background:'#fff', border:'1px solid var(--color-border)', borderRadius:'12px', width:'min(680px, 92vw)', padding:'1rem' }}>
        <FocusTrap onClose={close}>
          <header style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h2 id="cookie-title">Preferenze cookie</h2>
            <button className="btn" onClick={close} aria-label="Chiudi preferenze">Chiudi</button>
          </header>
          <p>Seleziona le categorie non essenziali che desideri attivare.</p>
          <form onSubmit={(e) => { e.preventDefault(); save(); }}>
            <fieldset>
              <legend>Categoria</legend>
              <div>
                <input id="c-functional" type="checkbox" checked={local.functional} onChange={(e)=>setLocal((s)=>({ ...s, functional: e.target.checked }))} />
                <label htmlFor="c-functional">Funzionali</label>
              </div>
              <div>
                <input id="c-analytics" type="checkbox" checked={local.analytics} onChange={(e)=>setLocal((s)=>({ ...s, analytics: e.target.checked }))} />
                <label htmlFor="c-analytics">Analitici</label>
              </div>
              <div>
                <input id="c-marketing" type="checkbox" checked={local.marketing} onChange={(e)=>setLocal((s)=>({ ...s, marketing: e.target.checked }))} />
                <label htmlFor="c-marketing">Marketing</label>
              </div>
            </fieldset>
            <div style={{ display:'flex', gap:'.5rem', marginTop:'1rem' }}>
              <button className="btn" type="submit">Salva preferenze</button>
              <button className="btn" type="button" onClick={close}>Annulla</button>
            </div>
          </form>
          <hr className="section-divider" />
          <button className="btn" onClick={() => { set({ policyVersion: '0.0.0', categories: { essential: true, functional:false, analytics:false, marketing:false }, timestamp: undefined }); close(); }}>
            Revoca consenso
          </button>
        </FocusTrap>
      </div>
    </div>
  );
}
`.trim(),

  'src/components/booking/validation.ts': `
import { z } from 'zod';
export const bookingSchema = z.object({
  date: z.string().min(1, 'Seleziona una data'),
  time: z.string().min(1, 'Seleziona un orario'),
  people: z.number().int().min(1, 'Minimo 1').max(50, 'Max 50'),
  type: z.enum(['pranzo','aperitivo','evento']).default('pranzo'),
  name: z.string().min(2, 'Inserisci il nome'),
  email: z.string().email('Email non valida'),
  phone: z.string().min(7, 'Telefono non valido'),
  notes: z.string().optional(),
  agreePrivacy: z.boolean().refine(v=>v===true,'Necessario per procedere'),
  agreeMarketing: z.boolean().optional()
});
export type BookingData = z.infer<typeof bookingSchema>;
`.trim(),

  'src/components/booking/BookingWizard.tsx': `
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
  const onSubmit = (data: BookingData) => { alert('Richiesta inviata!\\n'+JSON.stringify(data,null,2)); };

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
`.trim(),

  'src/components/booking/steps/Step1Date.tsx': `
'use client';
import { useFormContext } from 'react-hook-form';
export default function Step1Date() {
  const { register, formState: { errors } } = useFormContext();
  return (
    <fieldset>
      <legend>Data & orario</legend>
      <label htmlFor="date">Data</label><br/>
      <input id="date" type="date" {...register('date')} aria-invalid={!!errors.date} aria-describedby="err-date" /><br/>
      <span id="err-date" role="alert">{(errors.date as any)?.message}</span>
      <br/>
      <label htmlFor="time">Orario</label><br/>
      <input id="time" type="time" {...register('time')} aria-invalid={!!errors.time} aria-describedby="err-time" /><br/>
      <span id="err-time" role="alert">{(errors.time as any)?.message}</span>
    </fieldset>
  );
}
`.trim(),

  'src/components/booking/steps/Step2People.tsx': `
'use client';
import { useFormContext } from 'react-hook-form';
export default function Step2People() {
  const { register, formState: { errors }, setValue, watch } = useFormContext();
  const people = watch('people');
  return (
    <fieldset>
      <legend>Persone & tipologia</legend>
      <label htmlFor="people">Numero persone</label><br/>
      <input id="people" type="number" min={1} max={50} {...register('people', { valueAsNumber:true })} aria-invalid={!!errors.people} aria-describedby="err-people" /><br/>
      <span id="err-people" role="alert">{(errors.people as any)?.message}</span>
      <div style={{ marginTop:'.75rem' }}>
        <span id="type-label">Tipologia</span><br/>
        <div role="radiogroup" aria-labelledby="type-label" style={{ display:'flex', gap:'.5rem' }}>
          {['pranzo','aperitivo','evento'].map(t => (
            <label key={t} style={{ border:'1px solid var(--color-border)', padding:'.5rem', borderRadius:'12px' }}>
              <input type="radio" {...register('type')} value={t} onChange={()=>setValue('type', t as any)} /> {t}
            </label>
          ))}
        </div>
      </div>
      <p style={{ marginTop:'.5rem' }}>Hai selezionato {people} {people===1?'persona':'persone'}.</p>
    </fieldset>
  );
}
`.trim(),

  'src/components/booking/steps/Step3Details.tsx': `
'use client';
import { useFormContext } from 'react-hook-form';
export default function Step3Details() {
  const { register, formState: { errors } } = useFormContext();
  return (
    <fieldset>
      <legend>Dettagli</legend>
      <label htmlFor="name">Nome</label><br/>
      <input id="name" type="text" {...register('name')} aria-invalid={!!errors.name} aria-describedby="err-name" /><br/>
      <span id="err-name" role="alert">{(errors.name as any)?.message}</span>
      <br/><label htmlFor="email">Email</label><br/>
      <input id="email" type="email" {...register('email')} aria-invalid={!!errors.email} aria-describedby="err-email" /><br/>
      <span id="err-email" role="alert">{(errors.email as any)?.message}</span>
      <br/><label htmlFor="phone">Telefono</label><br/>
      <input id="phone" type="tel" {...register('phone')} aria-invalid={!!errors.phone} aria-describedby="err-phone" /><br/>
      <span id="err-phone" role="alert">{(errors.phone as any)?.message}</span>
      <br/><label htmlFor="notes">Note</label><br/>
      <textarea id="notes" {...register('notes')} rows={4} />
    </fieldset>
  );
}
`.trim(),

  'src/components/booking/steps/Step4Review.tsx': `
'use client';
import { useFormContext } from 'react-hook-form';
export default function Step4Review() {
  const { getValues, register, formState: { errors } } = useFormContext();
  const v = getValues();
  return (
    <section>
      <h3>Riepilogo</h3>
      <ul>
        <li>Data: <strong>{v.date}</strong></li>
        <li>Orario: <strong>{v.time}</strong></li>
        <li>Persone: <strong>{v.people}</strong></li>
        <li>Tipo: <strong>{v.type}</strong></li>
        <li>Nome: <strong>{v.name}</strong></li>
        <li>Email: <strong>{v.email}</strong></li>
        <li>Telefono: <strong>{v.phone}</strong></li>
      </ul>
      <div>
        <input id="agreePrivacy" type="checkbox" {...register('agreePrivacy')} aria-invalid={!!errors.agreePrivacy} aria-describedby="err-privacy" />
        <label htmlFor="agreePrivacy">Ho letto e accetto la <a href="/privacy">Privacy</a>.</label><br/>
        <span id="err-privacy" role="alert">{(errors.agreePrivacy as any)?.message}</span>
      </div>
      <div>
        <input id="agreeMarketing" type="checkbox" {...register('agreeMarketing')} />
        <label htmlFor="agreeMarketing">Acconsento a comunicazioni promozionali (facoltativo).</label>
      </div>
    </section>
  );
}
`.trim(),
};

// write files
Object.entries(files).forEach(([p, c]) => w(p, c));

// link wizard into /prenota/page.tsx
(() => {
  const p = 'src/app/prenota/page.tsx';
  if (!fs.existsSync(p)) { console.warn('! prenota/page.tsx non trovato, salto.'); return; }
  let s = fs.readFileSync(p, 'utf8');
  if (!/BookingWizard/.test(s)) {
    s = `import BookingWizard from '@/src/components/booking/BookingWizard';\n` + s.replace(/\/\*\s*<BookingWizard[^>]*>\s*\*\//,'');
    s = s.replace(/<\/main>/, `  <BookingWizard />\n    </main>`);
    fs.writeFileSync(p, s);
    console.log('• updated prenota/page.tsx -> usa BookingWizard');
  } else {
    console.log('• prenota/page.tsx già usa BookingWizard');
  }
})();

// update layout
addImportsToLayout();

console.log('✅ Fatto. Generati componenti cookie + wizard prenotazione.');
console.log('👉 Ora: pnpm i react-hook-form zod @hookform/resolvers zustand');
