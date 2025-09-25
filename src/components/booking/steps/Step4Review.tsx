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