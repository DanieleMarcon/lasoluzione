// src/app/(site)/page.tsx
import DeferredMap from '@/components/map/DeferredMap';

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
  if (Number.isNaN(date.getTime())) {
    return 'Data da definire';
  }

  const dateLabel = date.toLocaleDateString('it-IT', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const timeLabel = date.toLocaleTimeString('it-IT', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return `${dateLabel} · ${timeLabel}`;
}

function resolveEventDescription(event: PublicEvent) {
  const raw = event.excerpt ?? event.description ?? '';
  return raw.trim();
}

export default async function HomePage() {
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL ?? 'http://localhost:3000';
  let events: PublicEvent[] = [];

  try {
    const res = await fetch(`${baseUrl}/api/events?limit=6`, { cache: 'no-store' });
    const data = await res.json();
    if (Array.isArray(data)) {
      events = data as PublicEvent[];
    }
  } catch (error) {
    console.error('[home] failed to load events', error);
  }

  return (
    <section>
      <h1 style={{ color: '#112f4d', textAlign: 'center' }}>
        Il tuo bar di quartiere, eventi e buona compagnia
      </h1>

      <p style={{ textAlign: 'center' }}>
        Colazioni, pranzi veloci e serate con musica live. Prenota un tavolo o scopri i prossimi eventi.
      </p>

      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <a
          href="/prenota"
          style={{
            display: 'inline-block',
            background: '#112f4d',
            color: '#fff',
            borderRadius: 8,
            padding: '10px 16px',
            textDecoration: 'none',
          }}
        >
          Prenota ora
        </a>
      </div>

      {/* Eventi */}
      {events.length > 0 ? (
        <section id="eventi" aria-labelledby="eventi-title">
          <h2 id="eventi-title" style={{ color: '#112f4d' }}>
            Prossimi eventi
          </h2>
          <div role="list" style={{ display: 'grid', gap: 12 }}>
            {events.map((event) => {
              const description = resolveEventDescription(event);
              return (
                <div
                  key={event.id}
                  role="listitem"
                  style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}
                >
                  <strong>{event.title}</strong>
                  <div>{formatEventDate(event.startAt)}</div>
                  {description ? <div>{description}</div> : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Prenotazione */}
      <section id="prenota" style={{ marginTop: 48 }}>
        <h2 style={{ color: '#112f4d' }}>Prenota il tuo tavolo</h2>
        <p>Pausa pranzo, aperitivo o evento privato: scegli data, persone e lascia i dettagli.</p>
        <a
          href="/prenota"
          style={{
            display: 'inline-block',
            background: '#112f4d',
            color: '#fff',
            borderRadius: 8,
            padding: '10px 16px',
            textDecoration: 'none',
          }}
        >
          Vai alla prenotazione
        </a>
      </section>

      {/* Newsletter */}
      <section id="newsletter" style={{ marginTop: 48 }}>
        <h2 style={{ color: '#112f4d' }}>Newsletter</h2>
        <p>Novità, eventi e promozioni. Niente spam, promesso.</p>
        <form style={{ display: 'flex', gap: 8 }}>
          <input
            type="email"
            required
            aria-label="La tua email"
            placeholder="La tua email"
            style={{ flex: 1, padding: 10, borderRadius: 8, border: '1px solid #cbd5e1' }}
          />
          <button
            type="submit"
            style={{ padding: '10px 16px', borderRadius: 8, background: '#112f4d', color: '#fff' }}
          >
            Iscriviti
          </button>
        </form>
        <small>Riceverai una mail per confermare l’iscrizione (double opt-in).</small>
      </section>

      {/* Dove siamo — MAPPA */}
      <DoveSiamo />
    </section>
  );
}

/* ===== Sezione mappa ===== */
function DoveSiamo() {
  return (
    <section id="dove-siamo" style={{ marginTop: 48 }}>
      <h2 style={{ color: '#112f4d' }}>Dove siamo</h2>
      <DeferredMap />
    </section>
  );
}
