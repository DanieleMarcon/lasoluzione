// src/app/admin/not-authorized/page.tsx
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Accesso non autorizzato'
};

export default function NotAuthorizedPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#111827',
        color: '#f9fafb',
        padding: '2rem'
      }}
    >
      <div style={{ textAlign: 'center', maxWidth: 420, display: 'grid', gap: '1rem' }}>
        <h1 style={{ fontSize: '2rem', margin: 0 }}>Accesso non autorizzato</h1>
        <p style={{ margin: 0, color: '#d1d5db' }}>
          {"L'indirizzo email utilizzato non fa parte della lista autorizzata. Se pensi ci sia un"}
          {" errore contatta il responsabile del sito."}
        </p>
        <a
          href="/admin/signin"
          style={{
            display: 'inline-flex',
            justifyContent: 'center',
            alignItems: 'center',
            padding: '0.75rem 1.5rem',
            borderRadius: 999,
            backgroundColor: '#f59e0b',
            color: '#111827',
            fontWeight: 600,
            textDecoration: 'none'
          }}
        >
          Torna al login
        </a>
      </div>
    </div>
  );
}
