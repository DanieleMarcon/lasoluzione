// src/app/(site)/page.tsx
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const runtime = 'nodejs';

import Link from 'next/link';
import Script from 'next/script';

import Hero from '@/components/site/Hero';
import { getSiteConfig } from '@/lib/bookingSettings';

type PublicEvent = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  startAt: string;
  endAt: string | null;
  showOnHome: boolean;
  excerpt: string | null;
};

function formatEventDate(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Data da definire';

  return new Intl.DateTimeFormat('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function resolveEventDescription(event: PublicEvent) {
  const raw = event.excerpt ?? event.description ?? '';
  return raw.trim();
}

export default async function HomePage() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  const site = await getSiteConfig();
  let events: PublicEvent[] = [];

  try {
    const res = await fetch(`${baseUrl}/api/events?limit=6`, { cache: 'no-store' });
    const data = await res.json();
    if (Array.isArray(data)) events = data as PublicEvent[];
  } catch (error) {
    console.error('[home] failed to load events', error);
  }

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'Bar La Soluzione',
    url: baseUrl,
    image: [site.heroImageUrl || '/hero.jpg'],
    logo: site.brandLogoUrl || '/brand.svg',
    telephone: '+39 000 000 000',
    address: {
      '@type': 'PostalAddress',
      streetAddress: 'Via Mondovì 6',
      addressLocality: 'Milano',
      postalCode: '20132',
      addressCountry: 'IT',
    },
  };

  return (
    <>
      <Hero heroImageUrl={site.heroImageUrl} />
      <section id="eventi" aria-labelledby="eventi-title" className="bg-slate-950">
        <div className="mx-auto max-w-7xl px-4 py-16 md:px-6 md:py-24">
          <div className="max-w-3xl space-y-4">
            <h2 id="eventi-title" className="text-2xl font-semibold tracking-tight text-slate-100 md:text-3xl">
              Prossimi eventi
            </h2>
            <p className="text-base leading-relaxed text-slate-300 md:text-lg">
              Dalle merende con giochi alle serate a tema: scegli l&apos;evento che fa per te e prenota un posto in prima fila.
            </p>
          </div>
          {events.length > 0 ? (
            <div className="mt-10 grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
              {events.map((event) => {
                const description = resolveEventDescription(event);
                return (
                  <article
                    key={event.id}
                    className="relative flex h-full flex-col justify-between rounded-3xl border border-slate-800/60 bg-slate-900/60 p-6 shadow-lg shadow-slate-950/40 transition hover:border-amber-400/60 hover:shadow-amber-400/20"
                  >
                    <header className="space-y-3">
                      <p className="text-sm font-medium uppercase tracking-[0.25em] text-amber-300">
                        {formatEventDate(event.startAt)}
                      </p>
                      <h3 className="text-xl font-semibold leading-tight text-slate-100 md:text-2xl">{event.title}</h3>
                      {description ? (
                        <p className="text-sm leading-relaxed text-slate-300 md:text-base">{description}</p>
                      ) : null}
                    </header>
                    <footer className="mt-6 text-sm text-slate-300">
                      <p>Prenotazioni via modulo o direttamente al bancone.</p>
                    </footer>
                    <Link href="/prenota" aria-label="Prenota evento" className="absolute inset-0" />
                  </article>
                );
              })}
            </div>
          ) : (
            <p className="mt-10 rounded-3xl border border-slate-800/60 bg-slate-900/40 px-6 py-8 text-base text-slate-300 md:text-lg">
              Stiamo preparando il prossimo calendario: torna a trovarci o iscriviti alla newsletter per non perdere gli aggiornamenti.
            </p>
          )}
        </div>
      </section>
      <Script id="site-localbusiness" type="application/ld+json">
        {JSON.stringify(jsonLd)}
      </Script>
    </>
  );
}
