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