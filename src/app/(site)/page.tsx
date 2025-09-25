import Header from '@/src/components/layout/Header';
import Footer from '@/src/components/layout/Footer';
import Hero from '@/src/components/hero/Hero';
import EventsList from '@/src/components/events/EventsList';
import DeferredMap from '@/src/components/map/DeferredMap';
import Link from 'next/link';

export default async function HomePage() {
  // TODO: SSG con dati eventi (mock o CMS)
  return (
    <>
      <Header />
      <main id="main">
        <Hero />
        <section id="eventi" className="container">
          <h2>Prossimi eventi</h2>
          <div className="section-divider" />
          <EventsList />
        </section>

        <section id="prenota" className="container">
          <h2>Prenota il tuo pranzo / evento</h2>
          <p>Prenota un tavolo o organizza il tuo evento privato.</p>
          <Link className="btn" href="/prenota">Prenota ora</Link>
        </section>

        <section id="newsletter" className="container">
          <h2>Iscriviti alla newsletter</h2>
          <p>Ricevi aggiornamenti su eventi e promozioni. (Doppio opt-in)</p>
          {/* TODO: <NewsletterForm /> */}
          <form action="/api/newsletter" method="post" aria-describedby="news-help">
            <label htmlFor="email">Email</label><br />
            <input id="email" name="email" type="email" required aria-describedby="news-help" />
            <p id="news-help">Ti invieremo una email di conferma per completare l'iscrizione.</p>
            <button className="btn" type="submit">Iscriviti</button>
          </form>
        </section>

        <section id="contatti" className="container">
          <h2>Contatti & Mappa</h2>
          <address>Via Esempio 1, Milano<br/>+39 02 123456</address>
          <div className="section-divider" />
          <DeferredMap />
        </section>
      </main>
      <Footer />
    </>
  );
}
