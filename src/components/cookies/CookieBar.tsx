'use client';
import { useEffect, useState } from 'react';

import { useConsentStore } from '@/state/useConsentStore';
import { useCookieUI } from '@/state/useCookieUI';

const POLICY = process.env.NEXT_PUBLIC_POLICY_VERSION || '1.0.0';

export default function CookieBar() {
  const { categories, policyVersion, set } = useConsentStore();
  const { open } = useCookieUI();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // mostra banner se manca timestamp o policy cambiata
    const st: any = useConsentStore.getState();
    setVisible(policyVersion !== POLICY || !('timestamp' in st) || !st.timestamp);
  }, [policyVersion]);

  if (!visible) return null;

  const acceptAll = () => {
    set({ policyVersion: POLICY, categories: { ...categories, functional: true, analytics: true, marketing: true }, timestamp: Date.now() });
    setVisible(false);
  };
  const rejectAll = () => {
    set({ policyVersion: POLICY, categories: { essential: true, functional: false, analytics: false, marketing: false }, timestamp: Date.now() });
    setVisible(false);
  };

  return (
    <div role="region" aria-label="Informativa cookie" style={{ position:'fixed', insetInline:0, bottom:0, background:'#fff', borderTop:'1px solid var(--color-border)', zIndex:1000 }}>
      <div className="container" style={{ padding:'1rem', display:'grid', gap:'.75rem' }}>
        <p>
          Usiamo cookie essenziali e, previo consenso, funzionali/analitici/marketing.
          <a href="/cookie-policy" style={{ marginInlineStart: '.5rem' }}>Dettagli cookie</a> ·
          <a href="/privacy" style={{ marginInlineStart: '.5rem' }}>Privacy</a>
        </p>
        <div style={{ display:'flex', gap:'.5rem', flexWrap:'wrap' }}>
          <button className="btn" onClick={acceptAll}>Accetta tutto</button>
          <button className="btn" onClick={rejectAll} aria-label="Rifiuta tutti i cookie non essenziali">Rifiuta</button>
          <button className="btn" onClick={open} aria-haspopup="dialog" aria-controls="cookie-preferences">Preferenze</button>
        </div>
      </div>
    </div>
  );
}