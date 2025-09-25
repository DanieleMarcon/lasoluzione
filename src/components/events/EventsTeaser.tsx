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
