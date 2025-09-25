'use client';

import Link from 'next/link';

export default function Header() {
  return (
    <header
      role="banner"
      className="container"
      style={{
        padding: '1rem',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #e6e8eb',
        gap: '1rem',
        flexWrap: 'wrap'
      }}
    >
      <Link href="/" aria-label="Homepage">
        <strong style={{ color: '#112f4d', fontSize: '1.125rem', whiteSpace: 'nowrap' }}>
          Bar La Soluzione
        </strong>
      </Link>

      <nav aria-label="Principale">
        <ul style={{ display: 'flex', gap: '1rem', listStyle: 'none', margin: 0, padding: 0, flexWrap: 'wrap' }}>
          <li><a href="#eventi">Eventi</a></li>
          <li><a href="#prenota">Prenota</a></li>
          <li><a href="#newsletter">Newsletter</a></li>
          <li><a href="#contatti">Contatti</a></li>
        </ul>
      </nav>
    </header>
  );
}
