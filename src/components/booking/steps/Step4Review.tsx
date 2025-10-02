'use client';

import { useFormContext } from 'react-hook-form';
import type { BookingConfigDTO } from '@/types/bookingConfig';

type Step4ReviewProps = {
  config: BookingConfigDTO;
};

export default function Step4Review({ config }: Step4ReviewProps) {
  const {
    getValues,
    register,
    formState: { errors },
  } = useFormContext();

  const values = getValues();
  const typeLabel = config.typeLabels[values.type] ?? values.type;
  const requiresPrepay = config.prepayTypes.includes(values.type);

  return (
    <section>
      <h3>Riepilogo</h3>
      <ul>
        <li>
          Data: <strong>{values.date}</strong>
        </li>
        <li>
          Orario: <strong>{values.time}</strong>
        </li>
        <li>
          Persone: <strong>{values.people}</strong>
        </li>
        <li>
          Tipo: <strong>{typeLabel}</strong>
        </li>
        <li>
          Nome: <strong>{values.name}</strong>
        </li>
        <li>
          Email: <strong>{values.email}</strong>
        </li>
        <li>
          Telefono: <strong>{values.phone}</strong>
        </li>
      </ul>
      {requiresPrepay && (
        <p style={{ marginTop: '1rem', color: 'var(--color-warning, #a15f00)' }}>
          Questa tipologia richiede il pagamento anticipato per completare la prenotazione.
        </p>
      )}
      <div>
        <input
          id="agreePrivacy"
          type="checkbox"
          {...register('agreePrivacy')}
          aria-invalid={!!errors.agreePrivacy}
          aria-describedby="err-privacy"
        />
        <label htmlFor="agreePrivacy">
          Ho letto e accetto la <a href="/privacy">Privacy</a>.
        </label>
        <br />
        <span id="err-privacy" role="alert">{(errors.agreePrivacy as any)?.message}</span>
      </div>
      <div>
        <input id="agreeMarketing" type="checkbox" {...register('agreeMarketing')} />
        <label htmlFor="agreeMarketing">Acconsento a comunicazioni promozionali (facoltativo).</label>
      </div>
    </section>
  );
}
