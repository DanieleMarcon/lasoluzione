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
    return <p role="status" aria-live="polite">Controlla la tua email per confermare l’iscrizione. ✅</p>;
  }

  return (
    <form onSubmit={onSubmit} aria-describedby={err ? 'nlf-err' : undefined}>
      <label htmlFor="nlf-email">La tua email</label>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          id="nlf-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          aria-invalid={!!err}
          style={{ padding: '0.5rem', flex: '1 1 260px', borderRadius: 6, border: '1px solid #c9cdd2' }}
        />
        <button
          type="submit"
          style={{
            padding: '0.625rem 1rem',
            borderRadius: 8,
            border: '1px solid #112f4d',
            background: '#112f4d',
            color: 'white',
            minWidth: 44,
          }}
        >
          Iscriviti
        </button>
      </div>
      {err && (
        <p id="nlf-err" role="alert" style={{ color: '#b30000', marginTop: '0.5rem' }}>
          {err}
        </p>
      )}
      <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
        Riceverai una mail per confermare l’iscrizione (double opt-in).
      </p>
    </form>
  );
}
