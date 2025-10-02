'use client';
import { useEffect } from 'react';
import { useFormContext } from 'react-hook-form';

type Step2PeopleProps = {
  typeOptions: Array<{ value: string; label: string; requiresPrepay?: boolean }>;
  prepayAmountCents?: number;
};

export default function Step2People({ typeOptions, prepayAmountCents }: Step2PeopleProps) {
  const {
    register,
    formState: { errors },
    setValue,
    watch,
  } = useFormContext();

  const people = watch('people');
  const selectedType = watch('type');

  useEffect(() => {
    if (typeOptions.length === 0) return;
    if (!typeOptions.some(option => option.value === selectedType)) {
      const fallback = typeOptions[0];
      setValue('type', fallback.value as any, { shouldValidate: true });
    }
  }, [selectedType, setValue, typeOptions]);

  return (
    <fieldset>
      <legend>Persone &amp; tipologia</legend>
      <label htmlFor="people">Numero persone</label>
      <br />
      <input
        id="people"
        type="number"
        min={1}
        max={50}
        {...register('people', { valueAsNumber: true })}
        aria-invalid={!!errors.people}
        aria-describedby="err-people"
      />
      <br />
      <span id="err-people" role="alert">
        {(errors.people as any)?.message}
      </span>
      <div style={{ marginTop: '.75rem' }}>
        <span id="type-label">Tipologia</span>
        <br />
        <div role="radiogroup" aria-labelledby="type-label" style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          {typeOptions.length === 0 ? (
            <p>Nessuna tipologia disponibile al momento.</p>
          ) : (
            typeOptions.map(option => {
              const requiresPrepay = option.requiresPrepay;
              const prepayLabel =
                requiresPrepay && prepayAmountCents
                  ? ` (anticipo € ${(prepayAmountCents / 100).toFixed(2)})`
                  : requiresPrepay
                    ? ' (richiede anticipo)' 
                    : '';
              return (
                <label
                  key={option.value}
                  style={{
                    border: '1px solid var(--color-border)',
                    padding: '.5rem',
                    borderRadius: '12px',
                    minWidth: '140px',
                  }}
                >
                  <input type="radio" {...register('type')} value={option.value} />{' '}
                  {option.label}
                  {prepayLabel}
                </label>
              );
            })
          )}
        </div>
      </div>
      <p style={{ marginTop: '.5rem' }}>
        Hai selezionato {people} {people === 1 ? 'persona' : 'persone'}.
      </p>
    </fieldset>
  );
}