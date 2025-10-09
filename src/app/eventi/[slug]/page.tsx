import { notFound } from 'next/navigation';

import EventForm from './EventForm';
import { prisma } from '@/lib/prisma';
import { formatEventDateRange } from '@/lib/date';

interface EventPageProps {
  params: {
    slug: string;
  };
}

export default async function EventPage({ params }: EventPageProps) {
  const slug = decodeURIComponent(params.slug);

  const event = await prisma.eventInstance.findUnique({
    where: { slug },
  });

  if (!event || !event.active) {
    notFound();
  }

  const dateLabel = formatEventDateRange(event.startAt, event.endAt);

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-wide text-primary-600">
          Evento speciale
        </p>
        <h1 className="text-3xl font-semibold text-gray-900">{event.title}</h1>
        {dateLabel ? (
          <p className="text-base text-gray-600">{dateLabel}</p>
        ) : null}
      </header>

      {event.description ? (
        <div className="mt-8 whitespace-pre-line text-base text-gray-700">
          {event.description}
        </div>
      ) : null}

      <section className="mt-10 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-gray-900">Prenota senza pagare</h2>
        <p className="mt-1 text-sm text-gray-600">
          Compila il modulo per ricevere la mail di conferma della tua prenotazione.
        </p>
        <div className="mt-6">
          <EventForm eventSlug={event.slug} eventInstanceId={event.id} />
        </div>
      </section>
    </div>
  );
}
