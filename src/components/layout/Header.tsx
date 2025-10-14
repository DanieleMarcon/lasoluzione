'use client';

import Link from 'next/link';

export default function Header() {
  return (
    <header
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 16px',
        borderBottom: '1px solid #e5e7eb'
      }}
    >
      <Link href="/" style={{ color: '#112f4d', fontWeight: 700, textDecoration: 'none' }}>
        Bar La Soluzione
      </Link>
      <nav style={{ display: 'flex', gap: 16 }}>
        <Link href="/#eventi" className="text-white">
          Eventi
        </Link>
        <Link href="/prenota" className="text-white">
          Prenota
        </Link>
        <Link href="/#newsletter" className="text-white">
          Newsletter
        </Link>
        <Link href="/#contatti" className="text-white">
          Contatti
        </Link>
      </nav>
    </header>
  );
}
