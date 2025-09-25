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
