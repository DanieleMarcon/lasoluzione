import { notFound } from 'next/navigation';

import EventForm from './EventForm';
import { formatEventSchedule } from '@/lib/date';

interface EventPageProps {
  params: {
    slug: string;
  };
}

export default async function EventPage({ params }: EventPageProps) {
  const slug = decodeURIComponent(params.slug);

  if (!process.env.DATABASE_URL) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <h1 className="text-3xl font-semibold text-gray-900">Evento</h1>
        <p className="mt-4 text-base text-gray-700">
          Database non configurato (manca DATABASE_URL).
        </p>
      </div>
    );
  }

  const { prisma } = await import('@/lib/prisma');

  const event = await prisma.eventInstance.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      startAt: true,
      endAt: true,
      active: true,
    },
  });

  if (!event || !event.active) {
    notFound();
  }

  const scheduleLabel = formatEventSchedule(event.startAt, event.endAt);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900">{event.title}</h1>
        {scheduleLabel ? <p className="text-base text-gray-600">{scheduleLabel}</p> : null}
      </header>

      {event.description ? (
        <div className="mt-6 whitespace-pre-line text-base text-gray-700">{event.description}</div>
      ) : null}

      <section className="mt-10 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">Prenota senza pagare</h2>
        <p className="mt-1 text-sm text-gray-600">
          Compila il modulo per ricevere la mail di conferma della tua prenotazione.
        </p>
        <div className="mt-6">
          <EventForm eventSlug={slug} />
        </div>
      </section>
    </div>
  );
}
