'use client';

import { useEffect, useState } from 'react';
import { useConsentStore } from '@/state/useConsentStore';

const POLICY = process.env.NEXT_PUBLIC_POLICY_VERSION || '1.0.0';

export default function CookieBar() {
  const {
    policyVersion,
    timestamp,
    acceptAll,
    rejectAll,
    openPreferences,
    loadFromCookie,
  } = useConsentStore((s) => ({
    policyVersion: s.policyVersion,
    timestamp: s.timestamp,
    acceptAll: s.acceptAll,
    rejectAll: s.rejectAll,
    openPreferences: s.openPreferences,
    loadFromCookie: s.loadFromCookie,
  }));

  // Evita il render SSR: mostra il banner solo dopo il mount,
  // quando abbiamo caricato il cookie reale.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    loadFromCookie();
  }, [loadFromCookie]);

  if (!mounted) return null;

  const visible = !timestamp || policyVersion !== POLICY;
  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Informativa cookie"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        background: '#fff',
        borderTop: '1px solid var(--color-border)',
        zIndex: 1000,
      }}
    >
      <div className="container" style={{ padding: '1rem', display: 'grid', gap: '.75rem' }}>
        <p style={{ margin: 0 }}>
          Usiamo cookie essenziali e, previo consenso, funzionali/analitici/marketing.
          <a href="/cookie-policy" style={{ marginInlineStart: '.5rem' }}>Dettagli cookie</a> ·
          <a href="/privacy" style={{ marginInlineStart: '.5rem' }}>Privacy</a>
        </p>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button className="btn" onClick={acceptAll}>Accetta tutto</button>
          <button className="btn" onClick={rejectAll} aria-label="Rifiuta tutti i cookie non essenziali">Rifiuta</button>
          <button className="btn" onClick={openPreferences} aria-haspopup="dialog" aria-controls="cookie-preferences">Preferenze</button>
        </div>
      </div>
    </div>
  );
}
