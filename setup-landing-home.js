// setup-landing-home.js
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();

function ensureDir(p) {
  if (!fs.existsSync(p)) fs.mkdirSync(p, { recursive: true });
}

function writeFile(p, content, { allowOverwrite = true } = {}) {
  if (fs.existsSync(p) && !allowOverwrite) {
    console.log(`• Skip (esiste): ${p}`);
    return;
  }
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, content, 'utf8');
  console.log(`${fs.existsSync(p) ? '• Write' : '• Create'}: ${p}`);
}

function appendOnce(p, block, marker) {
  if (!fs.existsSync(p)) {
    ensureDir(path.dirname(p));
    fs.writeFileSync(p, block, 'utf8');
    console.log(`• Create: ${p} (nuovo con marker ${marker})`);
    return;
  }
  const s = fs.readFileSync(p, 'utf8');
  if (s.includes(marker)) {
    console.log(`• CSS già presente (${marker})`);
    return;
  }
  fs.writeFileSync(p, s.trimEnd() + `\n\n/* ${marker} */\n` + block + '\n', 'utf8');
  console.log(`• Append in ${p} (${marker})`);
}

// ---------- sorgenti ----------
const files = [
  {
    to: 'src/components/layout/Header.tsx',
    src: `\
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
`,
  },
  {
    to: 'src/components/hero/Hero.tsx',
    src: `\
export default function Hero() {
  return (
    <section
      aria-labelledby="hero-title"
      className="container"
      style={{ padding: '3rem 1rem', textAlign: 'center' }}
    >
      <h1 id="hero-title" style={{ color: '#112f4d', fontSize: '2rem', lineHeight: 1.2 }}>
        Il tuo bar di quartiere, eventi e buona compagnia
      </h1>
      <p style={{ maxWidth: 640, margin: '1rem auto' }}>
        Colazioni, pranzi veloci e serate con musica live. Prenota un tavolo o scopri i prossimi eventi.
      </p>
      <p>
        <a
          href="/prenota"
          className="btn"
          style={{
            display: 'inline-block',
            padding: '0.875rem 1.25rem',
            borderRadius: 8,
            border: '1px solid #112f4d',
            background: '#112f4d',
            color: 'white',
            textDecoration: 'none',
            minWidth: 44,
          }}
        >
          Prenota ora
        </a>
      </p>
    </section>
  );
}
`,
  },
  {
    to: 'src/components/events/EventsTeaser.tsx',
    src: `\
type EventItem = {
  id: string;
  title: string;
  date: string;
  blurb?: string;
};

const MOCK: EventItem[] = [
  { id: 'e1', title: 'Aperitivo Live Jazz', date: 'ven 4 ott · 19:00', blurb: 'Quartetto Jazz, ingresso libero.' },
  { id: 'e2', title: 'Serata Trivia',      date: 'mer 9 ott · 21:00', blurb: 'Quiz a squadre, premi finali.' },
  { id: 'e3', title: 'Degustazione Vini',  date: 'sab 19 ott · 18:30', blurb: 'Selezione cantine locali.' },
];

export default function EventsTeaser() {
  return (
    <section id="eventi" aria-labelledby="eventi-title" className="container" style={{ padding: '2rem 1rem' }}>
      <h2 id="eventi-title" style={{ color: '#112f4d' }}>Prossimi eventi</h2>
      <ul style={{ listStyle: 'none', padding: 0, margin: '1rem 0', display: 'grid', gap: '0.75rem' }}>
        {MOCK.map(ev => (
          <li key={ev.id} style={{ border: '1px solid #e6e8eb', borderRadius: 8, padding: '0.75rem 1rem' }}>
            <div style={{ fontWeight: 600 }}>{ev.title}</div>
            <div aria-label="data evento">{ev.date}</div>
            {ev.blurb && <p style={{ margin: '0.5rem 0 0' }}>{ev.blurb}</p>}
          </li>
        ))}
      </ul>
    </section>
  );
}
`,
  },
  {
    to: 'src/components/booking/PrenotaTeaser.tsx',
    src: `\
export default function PrenotaTeaser() {
  return (
    <section id="prenota" aria-labelledby="prenota-title" className="container" style={{ padding: '2rem 1rem' }}>
      <h2 id="prenota-title" style={{ color: '#112f4d' }}>Prenota il tuo tavolo</h2>
      <p>Pausa pranzo, aperitivo o evento privato: scegli data, persone e lascia i dettagli.</p>
      <p>
        <a
          href="/prenota"
          style={{
            display: 'inline-block',
            padding: '0.75rem 1rem',
            borderRadius: 8,
            border: '1px solid #112f4d',
            textDecoration: 'none',
            color: 'white',
            background: '#112f4d',
            minWidth: 44,
          }}
        >
          Vai alla prenotazione
        </a>
      </p>
    </section>
  );
}
`,
  },
  {
    to: 'src/components/newsletter/NewsletterForm.tsx',
    src: `\
'use client';

import { useState } from 'react';

export default function NewsletterForm() {
  const [email, setEmail] = useState('');
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) {
      setErr('Inserisci un indirizzo email valido.');
      return;
    }
    // TODO: chiamare endpoint double opt-in quando disponibile
    setOk(true);
  }

  if (ok) {
    return <p role="status" aria-live="polite">Controlla la tua email per confermare l’iscrizione. ✅</p>;
  }

  return (
    <form onSubmit={onSubmit} aria-describedby={err ? 'nlf-err' : undefined}>
      <label htmlFor="nlf-email">La tua email</label>
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input
          id="nlf-email"
          name="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          aria-invalid={!!err}
          style={{ padding: '0.5rem', flex: '1 1 260px', borderRadius: 6, border: '1px solid #c9cdd2' }}
        />
        <button
          type="submit"
          style={{
            padding: '0.625rem 1rem',
            borderRadius: 8,
            border: '1px solid #112f4d',
            background: '#112f4d',
            color: 'white',
            minWidth: 44,
          }}
        >
          Iscriviti
        </button>
      </div>
      {err && (
        <p id="nlf-err" role="alert" style={{ color: '#b30000', marginTop: '0.5rem' }}>
          {err}
        </p>
      )}
      <p style={{ fontSize: '0.875rem', marginTop: '0.5rem' }}>
        Riceverai una mail per confermare l’iscrizione (double opt-in).
      </p>
    </form>
  );
}
`,
  },
  {
    to: 'src/components/newsletter/NewsletterTeaser.tsx',
    src: `\
import NewsletterForm from '@/components/newsletter/NewsletterForm';

export default function NewsletterTeaser() {
  return (
    <section id="newsletter" aria-labelledby="nl-title" className="container" style={{ padding: '2rem 1rem' }}>
      <h2 id="nl-title" style={{ color: '#112f4d' }}>Newsletter</h2>
      <p>Novità, eventi e promozioni. Niente spam, promesso.</p>
      <NewsletterForm />
    </section>
  );
}
`,
  },
  {
    to: 'src/components/layout/Footer.tsx',
    src: `\
'use client';

import { useCookieUI } from '@/state/useCookieUI';

export default function Footer() {
  const { open } = useCookieUI();
  return (
    <footer id="contatti" className="container" style={{ padding: '2rem 1rem', borderTop: '1px solid #e6e8eb' }}>
      <h2 style={{ color: '#112f4d', fontSize: '1.25rem' }}>Contatti</h2>
      <address style={{ fontStyle: 'normal', margin: '0.5rem 0 1rem' }}>
        Via Esempio 1 – Città, IT<br />
        Tel: <a href="tel:+391234567890">+39 123 456 7890</a><br />
        Email: <a href="mailto:info@lasoluzione.eu">info@lasoluzione.eu</a>
      </address>

      <button
        onClick={open}
        aria-label="Apri centro preferenze cookie"
        style={{
          padding: '0.625rem 1rem',
          borderRadius: 8,
          border: '1px solid #112f4d',
          background: 'transparent',
          color: '#112f4d',
          minWidth: 44,
        }}
      >
        Gestisci cookie
      </button>

      <ul style={{ listStyle: 'none', padding: 0, marginTop: '1rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <li><a href="/privacy">Privacy</a></li>
        <li><a href="/cookie-policy">Cookie policy</a></li>
        <li><a href="https://instagram.com" target="_blank" rel="noreferrer">Instagram</a></li>
      </ul>
    </footer>
  );
}
`,
    // non forziamo overwrite: molti file footer già esiste -> sovrascrivere solo se vuoi
    allowOverwrite: true,
  },
  {
    to: 'src/app/(site)/page.tsx',
    src: `\
import Header from '@/components/layout/Header';
import Hero from '@/components/hero/Hero';
import EventsTeaser from '@/components/events/EventsTeaser';
import PrenotaTeaser from '@/components/booking/PrenotaTeaser';
import NewsletterTeaser from '@/components/newsletter/NewsletterTeaser';
import Footer from '@/components/layout/Footer';

export default function HomePage() {
  return (
    <main id="main" className="container" style={{ paddingBottom: '3rem' }}>
      <Header />
      <Hero />
      <EventsTeaser />
      <PrenotaTeaser />
      <NewsletterTeaser />
      <Footer />
    </main>
  );
}
`,
  },
];

// ---------- esecuzione ----------
(function main() {
  // 1) File
  for (const f of files) {
    writeFile(path.join(ROOT, f.to), f.src, { allowOverwrite: true });
  }

  // 2) CSS base + mobile (append una sola volta)
  const cssPath = path.join(ROOT, 'src/app/(site)/globals.css');
  const CSS_MARK = 'BAR_LS_BASE_AND_RESPONSIVE';
  const cssBlock = `
.container { max-width: 1100px; margin: 0 auto; }
a { color: #112f4d; }
a:hover, a:focus { text-decoration: underline; }
.btn:focus, button:focus, a:focus { outline: 2px solid #112f4d; outline-offset: 2px; }

/* Responsive semplici */
@media (max-width: 640px) {
  header[role="banner"] nav ul { gap: 0.75rem; }
  section.container { padding-left: 1rem; padding-right: 1rem; }
  h1 { font-size: 1.75rem; }
  h2 { font-size: 1.25rem; }
}
`;
  appendOnce(cssPath, cssBlock.trim(), CSS_MARK);

  console.log('\\n✅ Scaffold completato. Ora esegui:');
  console.log('   pnpm type-check && pnpm dev');
})();
