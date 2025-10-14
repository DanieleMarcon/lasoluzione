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
        Colazioni, pranzi veloci e aperitivi con musica. Prenota un tavolo o scopri i prossimi eventi.
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
