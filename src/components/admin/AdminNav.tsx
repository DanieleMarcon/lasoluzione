'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

const SHOW_LEGACY = process.env.NEXT_PUBLIC_ADMIN_SHOW_LEGACY === 'true';

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

const childLinkStyle: React.CSSProperties = {
  ...linkStyle,
  padding: '0.75rem 1rem 0.75rem 1.5rem',
};

const childActiveStyle: React.CSSProperties = {
  ...activeStyle,
  padding: '0.75rem 1rem 0.75rem 1.5rem',
};

const sectionTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.75rem',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: '#9ca3af',
  fontWeight: 600,
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

  const legacyHrefs = new Set(['/admin/menu/dishes', '/admin/tiers']);
  const visibleLinks = SHOW_LEGACY ? links : links.filter((link) => !legacyHrefs.has(link.href));
  const enhancedLinks = visibleLinks.map((link) => {
    const shouldMarkLegacy =
      SHOW_LEGACY && legacyHrefs.has(link.href) && !link.label.includes('(Legacy)');
    return {
      ...link,
      label: shouldMarkLegacy ? `${link.label} (Legacy)` : link.label,
    };
  });

  const catalogLinks: NavLink[] = [
    { href: '/admin/catalog/products', label: 'Prodotti' },
    { href: '/admin/events', label: 'Eventi' },
    { href: '/admin/catalog/sections', label: 'Sezioni' },
  ];

  const crmLinks: NavLink[] = [{ href: '/admin/contacts', label: 'Contatti' }];

  const sections: Array<{ key: string; title: string | null; items: NavLink[]; depth: 0 | 1 }> = [
    { key: 'main', title: null, items: enhancedLinks, depth: 0 },
    { key: 'catalog', title: 'Catalogo', items: catalogLinks, depth: 1 },
    { key: 'crm', title: 'CRM', items: crmLinks, depth: 1 },
  ];

  return (
    <aside style={navStyle}>
      <div style={{ display: 'grid', gap: '2rem' }}>
        <div>
          <p style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Dashboard Admin</p>
          <p style={{ margin: '0.25rem 0 0', color: '#9ca3af', fontSize: '0.9rem' }}>Bar La Soluzione</p>
        </div>
        <nav style={{ display: 'grid', gap: '1.5rem' }}>
          {sections.map((section) => (
            <div key={section.key} style={{ display: 'grid', gap: '0.5rem' }}>
              {section.title ? <p style={sectionTitleStyle}>{section.title}</p> : null}
              {section.items.map((link) => {
                const isActive = pathname === link.href || pathname.startsWith(`${link.href}/`);
                const style = section.depth > 0 ? (isActive ? childActiveStyle : childLinkStyle) : isActive ? activeStyle : linkStyle;
                return (
                  <Link key={link.href} href={link.href} style={style}>
                    {link.label}
                  </Link>
                );
              })}
            </div>
          ))}
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
