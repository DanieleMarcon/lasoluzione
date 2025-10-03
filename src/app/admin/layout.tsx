// src/app/admin/layout.tsx
import type { ReactNode } from 'react';

import { auth } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin/emails';
import AdminNav from '@/components/admin/AdminNav';
import AdminProviders from '@/components/admin/AdminProviders';

const links = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/bookings', label: 'Prenotazioni' },
  { href: '/admin/settings', label: 'Impostazioni' },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const isAdminUser = Boolean(email && isAdminEmail(email));

  if (!isAdminUser) {
    return (
      <html lang="it">
        <body style={{ margin: 0, backgroundColor: '#f3f4f6', fontFamily: 'Inter, system-ui, sans-serif' }}>
          {children}
        </body>
      </html>
    );
  }

  const adminSession = session!;

  return (
    <html lang="it">
      <body style={{ margin: 0, backgroundColor: '#f3f4f6', fontFamily: 'Inter, system-ui, sans-serif' }}>
        <AdminProviders session={adminSession}>
          <div style={{ display: 'flex', minHeight: '100vh' }}>
            <AdminNav links={links} userEmail={email ?? 'admin'} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <header
                style={{
                  padding: '1.5rem 2rem',
                  borderBottom: '1px solid #e5e7eb',
                  backgroundColor: '#fff',
                }}
              >
                <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>Area amministrativa</h1>
                <p style={{ margin: '0.25rem 0 0', color: '#6b7280', fontSize: '0.95rem' }}>
                  Gestisci prenotazioni e impostazioni del locale.
                </p>
              </header>
              <main style={{ flex: 1, padding: '2rem', overflowY: 'auto' }}>{children}</main>
            </div>
          </div>
        </AdminProviders>
      </body>
    </html>
  );
}
