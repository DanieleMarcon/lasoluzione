'use client';
export default function Footer() {
  const { open } = useCookieUI();
  return (
    <footer className="container" role="contentinfo" style={{ marginBlock: '2rem' }}>
      <hr className="section-divider" />
      <p>&copy; {new Date().getFullYear()} Il Tuo Bar — Tutti i diritti riservati.</p>
      <p>
        <a href="/privacy">Privacy</a> · <a href="/cookie-policy">Cookie policy</a> ·{' '}
        <button className="btn" onClick={open}>Gestisci cookie</button>
      </p>
      <p>
        Seguici: <a href="#" aria-label="Instagram">Instagram</a> · <a href="#" aria-label="Facebook">Facebook</a>
      </p>
    </footer>
  );
}
