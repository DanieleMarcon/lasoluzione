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
        className="grid gap-4 rounded-2xl border border-slate-700/60 bg-slate-900/40 p-6 text-slate-100"
      >
        <p className="m-0 text-base leading-relaxed">
          La mappa è disabilitata. Per visualizzarla abilita i cookie <strong>funzionali</strong>.
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={enableMap}
            className="inline-flex items-center justify-center rounded-full border border-slate-100/40 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-100 hover:bg-slate-100/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-100"
          >
            Attiva mappa (consenti funzionali)
          </button>
          <button
            type="button"
            onClick={openPreferences}
            className="inline-flex items-center justify-center rounded-full border border-slate-100/20 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-100/40 hover:bg-slate-100/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-100"
          >
            Apri preferenze
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-700/60 bg-slate-900/40">
      <div className="relative w-full pb-[56.25%]">
        <iframe
          title="Mappa"
          src={src}
          className="absolute inset-0 h-full w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
    </div>
  );
}
