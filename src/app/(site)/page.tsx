// src/app/(site)/page.tsx
export default function HomePage() {
  return (
    <section>
      <h1 style={{ color: '#112f4d', textAlign: 'center' }}>
        Il tuo bar di quartiere, eventi e buona compagnia
      </h1>

      <p style={{ textAlign: 'center' }}>
        Colazioni, pranzi veloci e serate con musica live. Prenota un tavolo o scopri i prossimi eventi.
      </p>

      <div style={{ textAlign: 'center', marginBottom: 32 }}>
        <a href="/prenota" style={{
          display: 'inline-block', background: '#112f4d', color: '#fff',
          borderRadius: 8, padding: '10px 16px', textDecoration: 'none'
        }}>
          Prenota ora
        </a>
      </div>

      {/* Eventi */}
      <section id="eventi" aria-labelledby="eventi-title">
        <h2 id="eventi-title" style={{ color: '#112f4d' }}>Prossimi eventi</h2>
        <div role="list" style={{ display: 'grid', gap: 12 }}>
          <div role="listitem" style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
            <strong>Aperitivo Live Jazz</strong>
            <div>ven 4 ott · 19:00</div>
            <div>Quartetto Jazz, ingresso libero.</div>
          </div>
          <div role="listitem" style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
            <strong>Serata Trivia</strong>
            <div>mer 9 ott · 21:00</div>
            <div>Quiz a squadre, premi finali.</div>
          </div>
        </div>
      </section>

      {/* Prenotazione */}
      <section id="prenota" style={{ marginTop: 48 }}>
        <h2 style={{ color: '#112f4d' }}>Prenota il tuo tavolo</h2>
        <p>Pausa pranzo, aperitivo o evento privato: scegli data, persone e lascia i dettagli.</p>
        <a href="/prenota" style={{
          display: 'inline-block', background: '#112f4d', color: '#fff',
          borderRadius: 8, padding: '10px 16px', textDecoration: 'none'
        }}>
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
          <button type="submit" style={{ padding: '10px 16px', borderRadius: 8, background: '#112f4d', color: '#fff' }}>
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
import DeferredMap from '@/components/map/DeferredMap';

function DoveSiamo() {
  return (
    <section id="dove-siamo" style={{ marginTop: 48 }}>
      <h2 style={{ color: '#112f4d' }}>Dove siamo</h2>
      <DeferredMap />
    </section>
  );
}
