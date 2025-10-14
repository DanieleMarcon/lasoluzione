'use client';
/* eslint-disable @next/next/no-img-element */

import { useState, type SVGProps } from 'react';
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

const iconProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 24,
  height: 24,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const satisfies SVGProps<SVGSVGElement>;

function MenuIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps} {...props}>
      <line x1="3" x2="21" y1="6" y2="6" />
      <line x1="3" x2="21" y1="12" y2="12" />
      <line x1="3" x2="21" y1="18" y2="18" />
    </svg>
  );
}

function XIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg {...iconProps} {...props}>
      <line x1="18" x2="6" y1="6" y2="18" />
      <line x1="6" x2="18" y1="6" y2="18" />
    </svg>
  );
}

export default function Header({ brandLogoUrl }: HeaderProps) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
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

  const handleMobileToggle = () => {
    setIsMobileMenuOpen((prev) => !prev);
  };

  const handleMobileLinkClick = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-white/20 bg-[#2596be]">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-4 md:px-6">
        <Link
          href="/"
          className="flex items-center gap-3 rounded-full border border-transparent px-2 py-1 text-sm font-semibold text-white transition hover:border-white/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#2596be]"
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
          className="hidden items-center justify-center gap-3 text-sm font-semibold md:flex"
        >
          {navLinks.map(({ href, label, isHomeAnchor }) => (
            <Link
              key={href}
              href={href}
              aria-current={computeAriaCurrent(href, isHomeAnchor)}
              className="inline-flex items-center rounded-md px-3 py-2 text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#2596be]"
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-3">
          <Link
            href="/admin/signin"
            className="hidden rounded-full border border-white/80 px-4 py-2 text-sm font-semibold text-white transition hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white md:inline-flex md:items-center md:justify-center"
          >
            Accedi
          </Link>
          <button
            type="button"
            aria-label={isMobileMenuOpen ? 'Chiudi menu' : 'Apri menu'}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-primary-navigation"
            onClick={handleMobileToggle}
            className="inline-flex items-center justify-center rounded-md p-2 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#2596be] md:hidden"
          >
            {isMobileMenuOpen ? <XIcon className="h-6 w-6" aria-hidden="true" /> : <MenuIcon className="h-6 w-6" aria-hidden="true" />}
          </button>
          <Link
            href="/admin/signin"
            onClick={handleMobileLinkClick}
            className="inline-flex items-center justify-center rounded-full border border-white/80 px-4 py-2 text-sm font-semibold text-white transition hover:border-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#2596be] md:hidden"
          >
            Accedi
          </Link>
        </div>
      </div>
      <nav
        id="mobile-primary-navigation"
        aria-label="Navigazione principale mobile"
        className={`${isMobileMenuOpen ? 'grid' : 'hidden'} gap-1 border-t border-white/20 bg-[#2596be] px-4 pb-4 md:hidden`}
      >
        {navLinks.map(({ href, label, isHomeAnchor }) => (
          <Link
            key={href}
            href={href}
            aria-current={computeAriaCurrent(href, isHomeAnchor)}
            onClick={handleMobileLinkClick}
            className="inline-flex items-center rounded-md px-3 py-2 text-base font-semibold text-white transition hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#2596be]"
          >
            {label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
