'use client';
import type { FormEvent } from 'react';
import FocusTrap from './FocusTrap';
import { useConsentStore } from '@/state/useConsentStore';

export default function PreferencesModal() {
  const {
    isPreferencesOpen,
    closePreferences,
    draft,
    setCategory,
    saveToCookie,
    rejectAll,
  } = useConsentStore((s) => ({
    isPreferencesOpen: s.isPreferencesOpen,
    closePreferences: s.closePreferences,
    draft: s.draft,
    setCategory: s.setCategory,
    saveToCookie: s.saveToCookie,
    rejectAll: s.rejectAll,
  }));

  if (!isPreferencesOpen) return null;

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    saveToCookie();
    closePreferences();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cookie-title"
      id="cookie-preferences"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,.4)',
        zIndex: 1001,
        display: 'grid',
        placeItems: 'center',
      }}
    >
      <div
        style={{
          background: '#fff',
          border: '1px solid var(--color-border)',
          borderRadius: '12px',
          width: 'min(680px, 92vw)',
          padding: '1rem',
        }}
      >
        <FocusTrap onClose={closePreferences}>
          <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2 id="cookie-title">Preferenze cookie</h2>
            <button className="btn" onClick={closePreferences} aria-label="Chiudi preferenze">Chiudi</button>
          </header>

          <p>Seleziona le categorie non essenziali che desideri attivare.</p>

          <form onSubmit={handleSubmit}>
            <fieldset>
              <legend>Categoria</legend>

              <div>
                <input
                  id="c-functional"
                  type="checkbox"
                  checked={draft.functional}
                  onChange={(e) => setCategory('functional', e.target.checked)}
                />
                <label htmlFor="c-functional">Funzionali</label>
              </div>

              <div>
                <input
                  id="c-analytics"
                  type="checkbox"
                  checked={draft.analytics}
                  onChange={(e) => setCategory('analytics', e.target.checked)}
                />
                <label htmlFor="c-analytics">Analitici</label>
              </div>

              <div>
                <input
                  id="c-marketing"
                  type="checkbox"
                  checked={draft.marketing}
                  onChange={(e) => setCategory('marketing', e.target.checked)}
                />
                <label htmlFor="c-marketing">Marketing</label>
              </div>
            </fieldset>

            <div style={{ display: 'flex', gap: '.5rem', marginTop: '1rem' }}>
              <button className="btn" type="submit">Salva preferenze</button>
              <button className="btn" type="button" onClick={closePreferences}>Annulla</button>
            </div>
          </form>

          <hr className="section-divider" />

          <button className="btn" type="button" onClick={rejectAll}>
            Revoca consenso
          </button>
        </FocusTrap>
      </div>
    </div>
  );
}
