'use client';

import { useEffect, useState } from 'react';
import { useConsentStore } from '@/state/useConsentStore';

const FALLBACK_SRC =
  'https://www.google.com/maps?q=Via+Mondov%C3%AC+6,+Milano&output=embed';

export default function DeferredMap() {
  const { categories, setCategory, saveToCookie, openPreferences, loadFromCookie } =
    useConsentStore((s) => ({
      categories: s.categories,
      setCategory: s.setCategory,
      saveToCookie: s.saveToCookie,
      openPreferences: s.openPreferences,
      loadFromCookie: s.loadFromCookie,
    }));

  // Evita che il placeholder SSR “blocchi” l’hydration.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    loadFromCookie();
  }, [loadFromCookie]);

  if (!mounted) return null;

  const src = (process.env.NEXT_PUBLIC_MAPS_EMBED_URL || '').trim() || FALLBACK_SRC;

  if (!categories.functional) {
    const enableMap = () => {
      setCategory('functional', true);
      saveToCookie();
    };

    return (
      <div
        role="region"
        aria-label="Mappa disabilitata finché non acconsenti ai cookie funzionali"
        style={{
          border: '1px dashed var(--color-border)',
          background: '#f8fafc',
          padding: '1rem',
          borderRadius: '12px',
        }}
      >
        <p style={{ marginTop: 0, marginBottom: '0.75rem' }}>
          La mappa è disabilitata. Per visualizzarla abilita i cookie <strong>funzionali</strong>.
        </p>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button className="btn" onClick={enableMap}>Attiva mappa (consenti funzionali)</button>
          <button className="btn" onClick={openPreferences}>Apri preferenze</button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="container"
      style={{
        border: '1px solid var(--color-border)',
        borderRadius: '12px',
        overflow: 'hidden',
      }}
    >
      <div style={{ position: 'relative', width: '100%', paddingTop: '56.25%' }}>
        <iframe
          title="Mappa"
          src={src}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
}
