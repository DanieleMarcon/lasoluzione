'use client';
import { useFormContext } from 'react-hook-form';

export default function Step3Details() {
  const {
    register,
    formState: { errors },
  } = useFormContext();

  return (
    <fieldset>
      <legend>Dettagli</legend>

      <label htmlFor="name">Nome e cognome</label>
      <br />
      <input
        id="name"
        type="text"
        {...register('name')}
        aria-invalid={!!(errors as any).name}
        aria-describedby="err-name"
      />
      <br />
      <span id="err-name" role="alert">{(errors as any).name?.message as any}</span>

      <br />
      <label htmlFor="email">Email</label>
      <br />
      <input
        id="email"
        type="email"
        {...register('email')}
        aria-invalid={!!(errors as any).email}
        aria-describedby="err-email"
      />
      <br />
      <span id="err-email" role="alert">{(errors as any).email?.message as any}</span>

      <br />
      <label htmlFor="phone">Telefono <span aria-hidden="true">*</span></label>
      <br />
      <input
        id="phone"
        type="tel"
        placeholder="+39 …"
        {...register('phone')}
        aria-invalid={!!(errors as any).phone}
        aria-describedby="err-phone"
      />
      <br />
      <span id="err-phone" role="alert">{(errors as any).phone?.message as any}</span>

      <br />
      <label htmlFor="notes">Note (opzionale)</label>
      <br />
      <textarea id="notes" rows={4} {...register('notes')} />
    </fieldset>
  );
}
