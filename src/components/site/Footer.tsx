/* eslint-disable @next/next/no-img-element */
import NewsletterForm from '@/components/newsletter/NewsletterForm';
import DeferredMap from '@/components/map/DeferredMap';
import { CookiePreferencesButton } from '@/components/site/CookiePreferencesButton';
import type { SiteConfigDTO } from '@/types/bookingConfig';

const usefulLinks = [
  { href: '/privacy', label: 'Privacy' },
  { href: '/cookie-policy', label: 'Cookie' },
  { href: '/accessibilita', label: 'Accessibilità' },
  { href: 'mailto:info@lasoluzione.eu', label: 'Contatti' },
  { href: '/#dove-siamo', label: 'Dove siamo' },
];

type FooterProps = {
  site: SiteConfigDTO;
};

export default function Footer({ site }: FooterProps) {
  return (
    <footer className="bg-[#004177] text-white" aria-labelledby="site-footer-title">
      <div className="border-t border-white/20">
        <div className="mx-auto flex max-w-7xl flex-col gap-16 px-4 pb-24 pt-16 md:px-6 md:pb-28 md:pt-24">
          <div className="grid gap-12 lg:grid-cols-12">
            <section
              id="contatti"
              className="lg:col-span-4"
              itemScope
              itemType="https://schema.org/LocalBusiness"
            >
              <h2 id="site-footer-title" itemProp="name" className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
                Bar La Soluzione
              </h2>
              <p className="mt-2 max-w-[60ch] text-base text-white/90">
                Un bar di quartiere a Milano, tra caffè speciali, pranzi veloci e aperitivi con musica.
              </p>
              <address className="mt-6 grid gap-2 text-sm not-italic text-white/90" itemProp="address" itemScope itemType="https://schema.org/PostalAddress">
                <span itemProp="streetAddress">Via Mondovì 6</span>
                <span>
                  <span itemProp="postalCode">20132</span> – <span itemProp="addressLocality">Milano</span>
                </span>
                <a
                  href="tel:+39000000000"
                  className="text-white/90 underline-offset-4 hover:text-white !text-white hover:!text-white"
                  itemProp="telephone"
                >
                  +39 000 000 000
                </a>
                <a
                  href="mailto:info@lasoluzione.eu"
                  className="text-white/90 underline-offset-4 hover:text-white !text-white hover:!text-white"
                  itemProp="email"
                >
                  info@lasoluzione.eu
                </a>
              </address>
              <div className="mt-6 flex flex-wrap items-center gap-3">
                <CookiePreferencesButton />
              </div>
            </section>

            <nav aria-label="Link utili" className="lg:col-span-4">
              <h2 className="text-2xl font-semibold tracking-tight text-white md:text-3xl">Link utili</h2>
              <ul className="mt-4 grid gap-2 text-base">
                {usefulLinks.map((link) => (
                  <li key={link.href}>
                    <a
                      href={link.href}
                      className="inline-flex items-center rounded-full px-3 py-2 text-white/90 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white !text-white hover:!text-white"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>

            <section id="newsletter" aria-labelledby="newsletter-title" className="lg:col-span-4">
              <h2 id="newsletter-title" className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
                Newsletter
              </h2>
              <p className="mt-2 text-base text-white/90">
                Novità dal bancone, eventi speciali e degustazioni dedicate. Una mail, quando serve davvero.
              </p>
              <div className="mt-4 max-w-xl">
                <NewsletterForm />
              </div>
            </section>
          </div>

          <section id="dove-siamo" aria-labelledby="dove-siamo-title" className="grid gap-6">
            <div className="flex items-baseline justify-between gap-4">
              <h2 id="dove-siamo-title" className="text-2xl font-semibold tracking-tight text-white md:text-3xl">
                Dove siamo
              </h2>
              <span className="text-sm text-white/80">Clicca sulla mappa per aprire Google Maps</span>
            </div>
            <DeferredMap />
          </section>
        </div>
      </div>
      <div className="border-t border-white/20 bg-[#004177]">
        <img
          src={site.footerRibbonUrl || '/ribbon.jpg'}
          alt="Da Samuel e Cinthia"
          width={1600}
          height={220}
          className="h-auto w-full object-cover"
          loading="lazy"
        />
      </div>
    </footer>
  );
}
