import type { Metadata } from 'next';
import Script from 'next/script';

import '../(site)/globals.css';
import { SkipLink } from '@/components/accessibility/SkipLink';
import ConsentScripts from '@/components/layout/ConsentScripts';
import CookieBar from '@/components/cookies/CookieBar';
import PreferencesModal from '@/components/cookies/PreferencesModal';

export const metadata: Metadata = {
  title: { default: 'Il Tuo Bar', template: '%s | Il Tuo Bar' },
  description: 'Bar & eventi. Prenota pranzo o evento privato. Iscriviti alla newsletter.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  openGraph: { type: 'website', title: 'Il Tuo Bar', images: ['/images/hero.jpg'] },
  alternates: { canonical: '/' },
  robots: { index: true, follow: true }
};

/**
 * Iniezione configurazione CMS lato client:
 * - In produzione, copia/edita /public/cms-config.example.js
 * - Puoi sostituire con fetch server se preferisci.
 */
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <head>
        {/* JSON-LD LocalBusiness: sostituisci i dati reali */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@type': 'CafeOrCoffeeShop',
              name: 'Il Tuo Bar',
              url: process.env.NEXT_PUBLIC_SITE_URL,
              address: { '@type': 'PostalAddress', addressLocality: 'Milano', addressCountry: 'IT' }
            })
          }}
        />
      </head>
      <body>
        <a className="visually-hidden" href="#main" id="skiplink">Salta al contenuto principale</a>
        <SkipLink targetId="main" />
        <ConsentScripts />
        {/* Carica config CMS lato client (opzionale) */}
        <Script src="/cms-config.example.js" strategy="afterInteractive" />
        {children}
        <CookieBar />
        <PreferencesModal />
      </body>
    </html>
  );
}
