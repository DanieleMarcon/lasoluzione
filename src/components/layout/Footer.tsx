'use client';

import { useCookieUI } from '@/state/useCookieUI';

export default function Footer() {
  const { open } = useCookieUI();
  return (
    <footer id="contatti" className="container" style={{ padding: '2rem 1rem', borderTop: '1px solid #e6e8eb' }}>
      <h2 style={{ color: '#112f4d', fontSize: '1.25rem' }}>Contatti</h2>
      <address style={{ fontStyle: 'normal', margin: '0.5rem 0 1rem' }}>
        Via Esempio 1 – Città, IT<br />
        Tel: <a href="tel:+391234567890">+39 123 456 7890</a><br />
        Email: <a href="mailto:info@lasoluzione.eu">info@lasoluzione.eu</a>
      </address>

      <button
        onClick={open}
        aria-label="Apri centro preferenze cookie"
        style={{
          padding: '0.625rem 1rem',
          borderRadius: 8,
          border: '1px solid #112f4d',
          background: 'transparent',
          color: '#112f4d',
          minWidth: 44,
        }}
      >
        Gestisci cookie
      </button>

      <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <li><a href="/privacy">Privacy</a></li>
        <li><a href="/cookie-policy">Cookie policy</a></li>
        <li><a href="https://instagram.com" target="_blank" rel="noreferrer">Instagram</a></li>
      </ul>
    </footer>
  );
}
