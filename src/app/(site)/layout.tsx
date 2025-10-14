// src/app/(site)/layout.tsx
import type { ReactNode } from 'react';

import CookieBar from '@/components/cookies/CookieBar';
import ConsentDebug from '@/components/cookies/ConsentDebug';
import PreferencesModal from '@/components/cookies/PreferencesModal';
import { SkipLink } from '@/components/accessibility/SkipLink';
import ConsentScripts from '@/components/layout/ConsentScripts';
import Footer from '@/components/site/Footer';
import Header from '@/components/site/Header';
import { getSiteConfig } from '@/lib/bookingSettings';

export const metadata = {
  title: 'Bar La Soluzione – eventi, prenotazioni e convivialità a Milano',
  description:
    'Il bar di quartiere a Milano tra caffè speciali, pranzi veloci e aperitivi con musica. Prenota subito o scopri gli eventi in programma.',
};

export default async function SiteLayout({ children }: { children: ReactNode }) {
  const site = await getSiteConfig();
  const showConsentDebug =
    process.env.NODE_ENV !== 'production' &&
    process.env.NEXT_PUBLIC_CONSENT_DEBUG === '1';

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <SkipLink targetId="main-content" />
      <Header brandLogoUrl={site.brandLogoUrl} />
      <main id="main-content" className="flex-1 bg-slate-950 pb-20">
        {children}
      </main>
      <Footer site={site} />

      {/* Consenso (montati una sola volta qui) */}
      <CookieBar />
      <PreferencesModal />
      <ConsentScripts />

      {showConsentDebug && <ConsentDebug />}
    </div>
  );
}
