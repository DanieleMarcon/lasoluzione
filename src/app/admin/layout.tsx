// src/app/admin/layout.tsx
import type { ReactNode } from 'react';

import { auth } from '@/lib/auth';
import { isAdminEmail } from '@/lib/admin/emails';
import AdminNav from '@/components/admin/AdminNav';
import AdminProviders from '@/components/admin/AdminProviders';

const links = [
  { href: '/admin', label: 'Dashboard' },
  { href: '/admin/bookings', label: 'Prenotazioni' },
  { href: '/admin/menu/dishes', label: 'Piatti pranzo' },
  { href: '/admin/tiers', label: 'Opzioni evento/aperitivo' },
  { href: '/admin/settings', label: 'Impostazioni' },
];

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await auth();
  const email = session?.user?.email ?? null;
  const isAdminUser = Boolean(email && isAdminEmail(email));

  if (!isAdminUser) {
    return <div className="min-h-screen bg-slate-100 font-sans">{children}</div>;
  }

  const adminSession = session!;

  return (
    <AdminProviders session={adminSession}>
      <div className="flex min-h-screen bg-slate-100 text-slate-900">
        <AdminNav links={links} userEmail={email ?? 'admin'} />
        <div className="flex flex-1 flex-col">
          <header className="border-b border-slate-200 bg-white px-8 py-6">
            <h1 className="text-2xl font-semibold text-slate-900">Area amministrativa</h1>
            <p className="mt-1 text-sm text-slate-600">Gestisci prenotazioni e impostazioni del locale.</p>
          </header>
          <main className="flex-1 overflow-y-auto px-8 py-6">{children}</main>
        </div>
      </div>
    </AdminProviders>
  );
}
