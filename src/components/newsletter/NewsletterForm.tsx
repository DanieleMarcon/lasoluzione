'use client';

import { useState } from 'react';

export default function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErr('Inserisci un indirizzo email valido.');
      return;
    }
    // TODO: chiamare endpoint double opt-in quando disponibile
    setOk(true);
  }

  if (ok) {
    return (
      <p role="status" aria-live="polite" className="rounded-xl border border-emerald-400/60 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100">
        Controlla la tua email per confermare l’iscrizione. ✅
      </p>
    );
  }

  return (
    <form onSubmit={onSubmit} aria-describedby={err ? 'nlf-err' : undefined} className="grid gap-3">
      <label htmlFor="nlf-email" className="text-sm font-semibold text-slate-100">
        La tua email
      </label>
      <div className="flex flex-col gap-3 sm:flex-row">
        <input
          id="nlf-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          aria-invalid={!!err}
          className="min-h-11 flex-1 rounded-full border border-slate-100/20 bg-slate-900/40 px-4 py-3 text-base text-slate-100 placeholder:text-slate-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-100"
        />
        <button
          type="submit"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-amber-400 px-6 py-3 text-base font-semibold text-slate-950 transition hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
        >
          Iscriviti
        </button>
      </div>
      {err && (
        <p id="nlf-err" role="alert" className="text-sm text-rose-200">
          {err}
        </p>
      )}
      <p className="text-sm text-slate-300">
        Riceverai una mail per confermare l’iscrizione (double opt-in).
      </p>
    </form>
  );
}
