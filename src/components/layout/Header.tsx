import Link from 'next/link';

export default function Header() {
  return (
    <header className="container" role="banner" style={{ paddingBlock: '1rem' }}>
      <nav aria-label="Principale" style={{ display: 'flex', gap: '1rem', alignItems: 'center', justifyContent: 'space-between' }}>
        <Link href="/" aria-label="Home">
          <img src="/images/logo.svg" alt="Logo del Bar" width="96" height="24" />
        </Link>
        <ul style={{ display: 'flex', gap: '1rem', listStyle: 'none', margin: 0, padding: 0 }}>
          <li><a href="#eventi">Eventi</a></li>
          <li><a href="#prenota">Prenota</a></li>
          <li><a href="#newsletter">Newsletter</a></li>
          <li><a href="#contatti">Contatti</a></li>
        </ul>
      </nav>
      <hr className="section-divider" />
    </header>
  );
}
