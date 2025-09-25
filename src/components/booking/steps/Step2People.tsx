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