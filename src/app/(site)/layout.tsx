// src/app/(site)/layout.tsx
import type { ReactNode } from 'react';

import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import CookieBar from '@/components/cookies/CookieBar';
import PreferencesModal from '@/components/cookies/PreferencesModal';
import ConsentScripts from '@/components/layout/ConsentScripts';
import ConsentDebug from '@/components/cookies/ConsentDebug';

export const metadata = {
  title: 'Bar La Soluzione',
  description:
    'Colazioni, pranzi veloci e serate con musica live. Prenota un tavolo o scopri i prossimi eventi.'
};

export default function SiteLayout({ children }: { children: ReactNode }) {
  const showConsentDebug =
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_CONSENT_DEBUG === '1';

  return (
    <div className="flex min-h-screen flex-col bg-white text-slate-900">
      <div className="flex justify-end px-6 py-3">
        <a
          href="/admin/signin"
          className="inline-flex items-center rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-900 transition hover:border-slate-300 hover:text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/50 focus:ring-offset-2"
        >
          Accedi
        </a>
      </div>
      <Header />
      <main id="main" className="container mx-auto flex-1 px-4 py-8 sm:px-6 lg:px-8">
        {children}
      </main>
      <Footer />

      {/* Consenso (montati una sola volta qui) */}
      <CookieBar />
      <PreferencesModal />
      <ConsentScripts />

      {showConsentDebug && <ConsentDebug />}
    </div>
  );
}
