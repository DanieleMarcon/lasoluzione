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
    <html lang="it">
      <body style={{ margin: 0, fontFamily: 'system-ui, Arial, sans-serif' }}>
        <Header />
        <main id="main" className="container" style={{ padding: '2rem 1rem', minHeight: '60vh' }}>
          {children}
        </main>
        <Footer />

        {/* Consenso (montati una sola volta qui) */}
        <CookieBar />
        <PreferencesModal />
        <ConsentScripts />

        {showConsentDebug && <ConsentDebug />}
      </body>
    </html>
  );
}
