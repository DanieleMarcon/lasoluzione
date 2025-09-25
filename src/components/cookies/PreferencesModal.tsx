'use client';
import { useState } from 'react';

import FocusTrap from './FocusTrap';

import { useConsentStore } from '@/state/useConsentStore';
import { useCookieUI } from '@/state/useCookieUI';

const POLICY = process.env.NEXT_PUBLIC_POLICY_VERSION || '1.0.0';

export default function PreferencesModal() {
  const { isModalOpen, close } = useCookieUI();
  const { categories, set } = useConsentStore();
  const [local, setLocal] = useState({ ...categories });

  if (!isModalOpen) return null;

  const save = () => {
    set({ policyVersion: POLICY, categories: { ...local }, timestamp: Date.now() });
    close();
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="cookie-title" id="cookie-preferences"
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.4)', zIndex:1001, display:'grid', placeItems:'center' }}>
      <div style={{ background:'#fff', border:'1px solid var(--color-border)', borderRadius:'12px', width:'min(680px, 92vw)', padding:'1rem' }}>
        <FocusTrap onClose={close}>
          <header style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h2 id="cookie-title">Preferenze cookie</h2>
            <button className="btn" onClick={close} aria-label="Chiudi preferenze">Chiudi</button>
          </header>
          <p>Seleziona le categorie non essenziali che desideri attivare.</p>
          <form onSubmit={(e) => { e.preventDefault(); save(); }}>
            <fieldset>
              <legend>Categoria</legend>
              <div>
                <input id="c-functional" type="checkbox" checked={local.functional} onChange={(e)=>setLocal((s)=>({ ...s, functional: e.target.checked }))} />
                <label htmlFor="c-functional">Funzionali</label>
              </div>
              <div>
                <input id="c-analytics" type="checkbox" checked={local.analytics} onChange={(e)=>setLocal((s)=>({ ...s, analytics: e.target.checked }))} />
                <label htmlFor="c-analytics">Analitici</label>
              </div>
              <div>
                <input id="c-marketing" type="checkbox" checked={local.marketing} onChange={(e)=>setLocal((s)=>({ ...s, marketing: e.target.checked }))} />
                <label htmlFor="c-marketing">Marketing</label>
              </div>
            </fieldset>
            <div style={{ display:'flex', gap:'.5rem', marginTop:'1rem' }}>
              <button className="btn" type="submit">Salva preferenze</button>
              <button className="btn" type="button" onClick={close}>Annulla</button>
            </div>
          </form>
          <hr className="section-divider" />
          <button className="btn" onClick={() => { set({ policyVersion: '0.0.0', categories: { essential: true, functional:false, analytics:false, marketing:false }, timestamp: undefined }); close(); }}>
            Revoca consenso
          </button>
        </FocusTrap>
      </div>
    </div>
  );
}