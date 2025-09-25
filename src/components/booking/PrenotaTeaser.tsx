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
