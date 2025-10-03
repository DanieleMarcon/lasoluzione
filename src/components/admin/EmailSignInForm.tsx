'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';

type Status = 'idle' | 'loading' | 'sent' | 'error';

export default function EmailSignInForm() {
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const email = (formData.get('email') as string | null)?.trim();

    if (!email) {
      setMessage("Inserisci un'email valida.");
      return;
    }

    try {
      setStatus('loading');
      setMessage(null);

      const response = await signIn('email', {
        email,
        callbackUrl: '/admin',
        redirect: false
      });

      if (response?.ok) {
        setStatus('sent');
        setMessage('Controlla la posta. Ti abbiamo inviato un link di accesso.');
      } else {
        setStatus('error');
        setMessage('Impossibile inviare il link. Riprova più tardi.');
      }
    } catch (error) {
      console.error('[admin] signIn error', error);
      setStatus('error');
      setMessage('Errore imprevisto. Riprova più tardi.');
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '1rem', maxWidth: 360 }}>
      <label style={{ display: 'grid', gap: '0.25rem' }}>
        <span>Indirizzo email</span>
        <input
          type="email"
          name="email"
          required
          placeholder="you@example.com"
          style={{
            padding: '0.75rem 1rem',
            borderRadius: 8,
            border: '1px solid #d0d5dd',
            fontSize: '1rem'
          }}
          disabled={status === 'loading'}
        />
      </label>
      <button
        type="submit"
        style={{
          padding: '0.75rem 1rem',
          borderRadius: 8,
          border: 'none',
          fontSize: '1rem',
          fontWeight: 600,
          backgroundColor: '#111827',
          color: '#fff',
          cursor: status === 'loading' ? 'wait' : 'pointer'
        }}
        disabled={status === 'loading'}
      >
        {status === 'loading' ? 'Invio in corso…' : 'Invia link di accesso'}
      </button>

      {message && (
        <p style={{ color: status === 'error' ? '#b91c1c' : '#065f46', fontSize: '0.95rem' }}>
          {message}
        </p>
      )}
    </form>
  );
}
