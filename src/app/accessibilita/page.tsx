import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Accessibilità – Bar La Soluzione',
  description:
    'Dichiarazione di accessibilità del Bar La Soluzione con riferimento alle linee guida WCAG 2.1 livello AA.',
};

export default function AccessibilityPage() {
  return (
    <section className="bg-slate-950">
      <div className="mx-auto max-w-3xl px-4 py-16 text-slate-100 md:px-6 md:py-24">
        <h1 className="text-4xl font-semibold tracking-tight md:text-5xl">Accessibilità</h1>
        <p className="mt-6 text-base leading-relaxed text-slate-300 md:text-lg">
          Ci impegniamo a rendere il sito del Bar La Soluzione accessibile e fruibile dal maggior numero possibile di persone,
          in linea con le linee guida WCAG 2.1 livello AA. Continueremo ad aggiornare i contenuti e l&apos;interfaccia per
          garantire un&apos;esperienza inclusiva.
        </p>
        <ul className="mt-8 grid gap-4 text-base text-slate-200 md:text-lg">
          <li>
            Utilizziamo gerarchie semantiche corrette, landmark ARIA e focus visibili per facilitare la navigazione via
            tastiera e tecnologie assistive.
          </li>
          <li>
            I contrasti colore sono verificati per rispettare gli standard AA e le immagini significative hanno alternative
            testuali descrittive.
          </li>
          <li>
            Accogliamo feedback: se riscontri barriere scrivici a{' '}
            <a
              href="mailto:accessibilita@lasoluzione.eu"
              className="text-amber-300 underline-offset-4 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-200"
            >
              accessibilita@lasoluzione.eu
            </a>
            .
          </li>
        </ul>
        <p className="mt-8 text-base leading-relaxed text-slate-300 md:text-lg">
          Questa dichiarazione è aggiornata al {new Date().getFullYear()} e viene rivista almeno una volta all&apos;anno.
        </p>
      </div>
    </section>
  );
}
