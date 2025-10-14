'use client';
import { useConsentStore } from '@/state/useConsentStore';

export default function Footer() {
  const openPreferences = useConsentStore((s) => s.openPreferences);

  return (
    <footer id="contatti" style={{ padding: '24px 16px', borderTop: '1px solid #e5e7eb', display: 'grid', gap: 16 }}>
      <div style={{ display: 'grid', gap: 8 }}>
        <strong>Contatti</strong>
        <div>Via Mondovì 6, 20132 – Milano</div>
        <div>
          Tel:{' '}
          <a href="tel:+39000000000" className="text-white">
            +39 000 000 000
          </a>
        </div>
        <div>
          Email:{' '}
          <a href="mailto:info@lasoluzione.eu" className="text-white">
            info@lasoluzione.eu
          </a>
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <button
            type="button"
            onClick={openPreferences}
            aria-label="Apri centro preferenze cookie"
            style={{ padding: '0.625rem 1rem', borderRadius: 8, border: '1px solid #cbd5e1', background: '#fff', color: '#112f4d' }}
          >
            Gestisci cookie
          </button>
          <a href="/privacy" className="text-white">
            Privacy
          </a>
          <a href="/cookie-policy" className="text-white">
            Cookie policy
          </a>
        </div>
      </div>
    </footer>
  );
}
