'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

const navStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
  padding: '2rem 1.5rem',
  minWidth: 220,
  backgroundColor: '#111827',
  color: '#fff',
};

const linkStyle: React.CSSProperties = {
  padding: '0.75rem 1rem',
  borderRadius: 12,
  color: '#e5e7eb',
  textDecoration: 'none',
  fontWeight: 500,
};

const activeStyle: React.CSSProperties = {
  ...linkStyle,
  backgroundColor: '#1f2937',
  color: '#f9fafb',
};

type NavLink = {
  href: string;
  label: string;
};

type Props = {
  links: NavLink[];
  userEmail: string;
};

export default function AdminNav({ links, userEmail }: Props) {
  const pathname = usePathname();

  return (
    <aside style={navStyle}>
      <div style={{ display: 'grid', gap: '2rem' }}>
        <div>
          <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Dashboard Admin</p>
          <p style={{ margin: '0.25rem 0 0', color: '#9ca3af', fontSize: '0.9rem' }}>Bar La Soluzione</p>
        </div>
        <nav style={{ display: 'grid', gap: '0.5rem' }}>
          {links.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
            return (
              <Link key={link.href} href={link.href} style={isActive ? activeStyle : linkStyle}>
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>

      <div
        style={{
          borderTop: '1px solid rgba(255,255,255,0.12)',
          paddingTop: '1rem',
          color: '#d1d5db',
          fontSize: '0.9rem',
          display: 'grid',
          gap: '0.75rem',
        }}
      >
        <div>
          <strong>{userEmail}</strong>
        </div>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: '/admin/signin' })}
          style={{
            padding: '0.6rem 1rem',
            borderRadius: 10,
            border: '1px solid rgba(255,255,255,0.24)',
            background: 'transparent',
            color: '#f9fafb',
            cursor: 'pointer',
            fontWeight: 600,
          }}
        >
          Esci
        </button>
      </div>
    </aside>
  );
}
