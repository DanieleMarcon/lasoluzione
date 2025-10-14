// src/app/admin/(protected)/layout.tsx
import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import AdminNav from '@/components/admin/AdminNav';
import AdminProviders from '@/components/admin/AdminProviders';
import '@/app/(site)/globals.css';

export const metadata: Metadata = {
  title: 'Dashboard Admin – La Soluzione',
};

export default async function ProtectedAdminLayout({
  children,
}: { children: ReactNode }) {
  const session = await auth();

  // Se NON loggato → vai alla signin
  if (!session?.user) {
    redirect('/admin/signin?from=/admin');
  }

  // link della sidebar
  const links = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/bookings', label: 'Prenotazioni' },
    { href: '/admin/catalog/products', label: 'Prodotti' },
    { href: '/admin/events', label: 'Eventi' },
    { href: '/admin/tiers', label: 'Tiers' },
    { href: '/admin/catalog/sections', label: 'Sezioni' },
    { href: '/admin/contacts', label: 'Contatti' },
    { href: '/admin/settings', label: 'Impostazioni' },
  ];

  const userEmail = session.user?.email ?? '';

  return (
    <AdminProviders session={session} links={links} userEmail={userEmail}>
      <div className="min-h-screen flex bg-gray-50">
        {/* Sidebar */}
        <aside className="w-72 shrink-0 bg-slate-900 text-white">
          <div className="h-16 flex items-center px-5 text-lg font-semibold border-b border-white/10">
            Dashboard Admin
          </div>
          <nav className="p-4">
            {/* Se il tuo AdminNav richiede props, passagli `links` / `userEmail` */}
            <AdminNav links={links} userEmail={userEmail} />
          </nav>
        </aside>

        {/* Contenuto */}
        <main className="flex-1 min-w-0">
          <div className="min-h-screen p-6 md:p-8">{children}</div>
        </main>
      </div>
    </AdminProviders>
  );
}
