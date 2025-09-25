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
