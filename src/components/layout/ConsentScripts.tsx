// src/components/layout/ConsentScripts.tsx
'use client';

import { useEffect } from 'react';
import Script from 'next/script';

import { useConsentStore } from '@/state/useConsentStore';

export default function ConsentScripts() {
  const { categories, loadFromCookie } = useConsentStore();

  useEffect(() => {
    loadFromCookie();
  }, [loadFromCookie]);

  return (
    <>
      {/* Esempio: monta Analytics solo se consentito */}
      {categories.analytics && (
        <Script id="ga" strategy="afterInteractive">
          {`
            // Esempio placeholder: inizializza qui il tuo analytics
            // window.dataLayer = window.dataLayer || [];
            // function gtag(){dataLayer.push(arguments);}
            // gtag('js', new Date());
            // gtag('config', 'G-XXXXXXX');
          `}
        </Script>
      )}
    </>
  );
}
