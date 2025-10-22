import Link from 'next/link';

type HeroProps = {
  heroImageUrl?: string | null;
};

export default function Hero({ heroImageUrl }: HeroProps) {
  const imageUrl = typeof heroImageUrl === 'string' && heroImageUrl.trim().length > 0 ? heroImageUrl : '/hero.jpg';

  return (
    <section
      aria-labelledby="hero-heading"
      className="relative isolate overflow-hidden"
      style={{
        backgroundImage: `linear-gradient(135deg, rgba(8, 15, 32, 0.88), rgba(8, 15, 32, 0.65)), url(${imageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      }}
    >
      <div className="absolute inset-0 -z-10 bg-slate-600/50" aria-hidden="true" />
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-4 py-20 text-slate-100 md:px-6 md:py-28">
        <p className="text-sm font-medium uppercase tracking-[0.35em] text-amber-300">Bar di quartiere a Milano</p>
        <div className="max-w-3xl space-y-6">
          <h1 id="hero-heading" className="text-balance text-5xl font-semibold leading-tight md:text-6xl">
            Dia de los Meurtos
          </h1>
          <p className="max-w-[60ch] text-lg leading-relaxed text-slate-200 md:text-xl">
            Il 31 ottobre, il Bar La Soluzione si trasforma in un luogo di mistero e divertimento. DJ set, cocktail spettrali e un&apos;atmosfera da brivido ti aspettano!
          </p>
          <div className="flex flex-wrap gap-4">
            <Link
              href="/prenota"
              aria-label="Prenota ora il tuo tavolo o evento al Bar La Soluzione"
              className="inline-flex items-center justify-center rounded-full bg-amber-400 px-8 py-3 text-base font-semibold text-slate-950 shadow-lg shadow-amber-400/20 transition hover:bg-amber-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
            >
              Prenota ora
            </Link>
            <Link
              href="/#eventi"
              className="inline-flex items-center justify-center rounded-full border border-slate-100/40 px-8 py-3 text-base font-semibold text-white transition hover:border-slate-100/60 hover:bg-slate-100/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
            >
              Guarda gli eventi
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
