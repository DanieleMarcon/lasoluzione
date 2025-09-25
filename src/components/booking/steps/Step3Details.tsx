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