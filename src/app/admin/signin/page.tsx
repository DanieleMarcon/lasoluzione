// src/app/admin/signin/page.tsx
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import EmailSignInForm from '@/components/admin/EmailSignInForm';

type PageProps = {
  searchParams?: {
    error?: string;
    from?: string;
  };
};

export const metadata: Metadata = {
  title: 'Accesso area admin – La Soluzione',
};

export default async function AdminSignInPage({ searchParams }: PageProps) {
  // Se sei già autenticato, vai direttamente in /admin
  const session = await auth();
  if (session?.user) {
    redirect('/admin');
  }

  const error = searchParams?.error;
  const accessDenied = error === 'AccessDenied';

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6',
        padding: '2rem',
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 16,
          padding: '2.5rem',
          maxWidth: 480,
          width: '100%',
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
          display: 'grid',
          gap: '1.5rem',
        }}
      >
        <header style={{ display: 'grid', gap: '0.25rem' }}>
          <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Area riservata</h1>
          <p style={{ margin: 0, color: '#6b7280' }}>
            Inserisci il tuo indirizzo email per ricevere un link di accesso.
          </p>
        </header>

        {accessDenied && (
          <div
            role="alert"
            style={{
              padding: '1rem',
              borderRadius: 12,
              backgroundColor: '#fef2f2',
              color: '#991b1b',
              fontSize: '0.95rem',
            }}
          >
            {"Questo indirizzo non è autorizzato ad accedere all'area admin."}
          </div>
        )}

        {/* Se EmailSignInForm supporta callbackUrl, passalo per sicurezza */}
        {/* <EmailSignInForm callbackUrl="/admin" /> */}
        <EmailSignInForm />
      </div>
    </div>
  );
}
