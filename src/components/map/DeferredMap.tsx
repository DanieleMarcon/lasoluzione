'use client';
import { useConsentStore } from '@/src/state/useConsentStore';

export default function DeferredMap() {
  const { categories } = useConsentStore();
  if (!categories.functional && !categories.marketing) {
    return (
      <div role="region" aria-label="Mappa bloccata" className="container" style={{ border: '1px dashed var(--color-border)', padding: '1rem', borderRadius: '12px' }}>
        <p>La mappa è bloccata finché non acconsenti ai cookie funzionali/marketing.</p>
        <button className="btn" onClick={() => alert('Apri il Centro preferenze cookie')}>
          Gestisci cookie
        </button>
      </div>
    );
  }
  // TODO: carica script/iframe Google Maps qui
  return (
    <div className="container" style={{ aspectRatio: '16/9', border: '1px solid var(--color-border)', borderRadius: '12px' }}>
      <p className="visually-hidden">Mappa caricata</p>
      {/* <iframe ... title="Mappa del bar" /> */}
    </div>
  );
}
