// src/app/admin/(protected)/layout.tsx
import type { ReactNode } from 'react'
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import AdminProviders from '@/components/admin/AdminProviders'
import AdminNav from '@/components/admin/AdminNav'

type Props = { children: ReactNode }

export default async function ProtectedAdminLayout({ children }: Props) {
  const session = await auth()
  if (!session?.user?.email) {
    redirect('/admin/signin?from=/admin')
  }

  // Link del menu (aggiungi/rimuovi a piacere)
  const links = [
    { href: '/admin', label: 'Dashboard' },
    { href: '/admin/bookings', label: 'Prenotazioni' },
    { href: '/admin/catalog/products', label: 'Prodotti' },
    { href: '/admin/events', label: 'Eventi' },
    { href: '/admin/tiers', label: 'Tiers' },
    { href: '/admin/contacts', label: 'Contatti' },
    { href: '/admin/settings', label: 'Impostazioni' },
  ]

  const userEmail = session.user.email

  return (
    <AdminProviders session={session}>
      <div className="min-h-screen flex bg-gray-50">
        {/* Sidebar */}
        <aside className="w-72 shrink-0 bg-slate-900 text-white">
          <div className="flex h-full flex-col">
            <header className="border-b border-white/10 px-6 py-5">
              <p className="text-lg font-semibold">Dashboard Admin</p>
              <p className="text-sm text-slate-300">Bar La Soluzione</p>
            </header>
            <AdminNav links={links} userEmail={userEmail} />
          </div>
        </aside>

        {/* Contenuto */}
        <main className="flex-1 p-6">{children}</main>
      </div>
    </AdminProviders>
  )
}
