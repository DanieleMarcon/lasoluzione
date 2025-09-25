'use client';
import Script from 'next/script';
import { useConsentStore } from '@/src/state/useConsentStore';

/**
 * Monta script di terze parti SOLO se c'è consenso.
 * TODO: rimpiazza i placeholder con i tuoi ID/SDK.
 */
export default function ConsentScripts() {
  const { categories } = useConsentStore();

  return (
    <>
      {categories.analytics && (
        <>
          {/* Esempio: Analytics */}
          {/* <Script id="ga" strategy="afterInteractive">
            {`/* gtag config ... */`}
          </Script> */}
        </>
      )}
      {/* Altre categorie: functional / marketing */}
    </>
  );
}
