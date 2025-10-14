/**
 * TODO (fase 2): leggere da CMS via adapter con fallback locale.
 */
import Link from 'next/link';
import EventCard from './EventCard';

const mock = [
  { id: '1', title: 'Live Jazz Night', date: '2025-10-01', time: '21:00' },
  { id: '2', title: 'Aperitivo DJ Set', date: '2025-10-05', time: '19:00' }
];

export default function EventsList() {
  return (
    <div aria-live="polite" aria-busy="false" style={{ display: 'grid', gap: '1rem' }}>
      {mock.map((event) => (
        <Link
          key={event.id}
          href="/prenota"
          aria-label={`Prenota: ${event.title}`}
          style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}
        >
          <EventCard event={event} />
        </Link>
      ))}
    </div>
  );
}
