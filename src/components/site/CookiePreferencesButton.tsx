'use client';

import { useConsentStore } from '@/state/useConsentStore';

export function CookiePreferencesButton() {
  const openPreferences = useConsentStore((state) => state.openPreferences);
  return (
    <button
      type="button"
      onClick={openPreferences}
      className="inline-flex items-center justify-center rounded-full border border-slate-100/20 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-100/40 hover:bg-slate-100/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-100"
      aria-label="Apri centro preferenze cookie"
    >
      Gestisci cookie
    </button>
  );
}
