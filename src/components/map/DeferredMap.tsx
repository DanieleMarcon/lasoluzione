'use client';
import { useConsentStore } from '@/state/useConsentStore';

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
  
  const mapSrc = "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d2797.000000!2d9.1900!3d45.4642!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x0%3A0x0!2sIl%20Tuo%20Bar!5e0!3m2!1sit!2sit!4v0000000000000"; // TODO: sostituisci con il tuo embed
  return (
    <div className="container" style={{ aspectRatio: '16/9', border: '1px solid var(--color-border)', borderRadius: '12px', overflow: 'hidden' }}>
      <iframe
        title="Mappa del bar"
        src={mapSrc}
        width="100%"
        height="100%"
        style={{ border: 0 }}
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
      />
    </div>
  );
}