'use client';
/* eslint-disable @next/next/no-img-element */

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const navLinks = [
  { href: '/#eventi', label: 'Eventi', isHomeAnchor: true },
  { href: '/prenota', label: 'Prenota' },
  { href: '/#newsletter', label: 'Newsletter/Contatti', isHomeAnchor: true },
];

type HeaderProps = {
  brandLogoUrl?: string | null;
};

export default function Header({ brandLogoUrl }: HeaderProps) {
  const pathname = usePathname();
  const logoUrl = typeof brandLogoUrl === 'string' && brandLogoUrl.trim().length > 0 ? brandLogoUrl : '/brand.svg';

  const computeAriaCurrent = (href: string, isHomeAnchor?: boolean) => {
    if (href.startsWith('/prenota') && pathname.startsWith('/prenota')) {
      return 'page';
    }
    if (isHomeAnchor && pathname === '/') {
      return 'page';
    }
    if (href === '/' && pathname === '/') {
      return 'page';
    }
    return undefined;
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-800/60 bg-slate-950/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 md:px-6">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-full border border-transparent px-2 py-1 text-sm font-semibold text-slate-100 transition hover:border-slate-100/40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
        >
          <img
            src={logoUrl}
            alt="La Soluzione – arriva dopo un buon caffè"
            width={164}
            height={48}
            className="h-14 w-auto max-w-[220px]"
            loading="lazy"
          />
        </Link>
        <nav
          aria-label="Navigazione principale"
          className="flex flex-wrap items-center justify-center gap-3 text-sm font-semibold text-slate-100"
        >
          {navLinks.map(({ href, label, isHomeAnchor }) => (
            <Link
              key={href}
              href={href}
              aria-current={computeAriaCurrent(href, isHomeAnchor)}
              className="inline-flex items-center rounded-full px-3 py-2 text-slate-100 transition hover:bg-slate-100/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/signin"
            className="inline-flex items-center justify-center rounded-full border border-slate-100/30 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-100/60 hover:bg-slate-100/5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-300"
          >
            Accedi
          </Link>
        </div>
      </div>
    </header>
  );
}
