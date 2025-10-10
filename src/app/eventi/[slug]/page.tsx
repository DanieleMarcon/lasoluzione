import { notFound } from 'next/navigation';

import EventForm from './EventForm';
import { formatEventSchedule } from '@/lib/date';

const currencyFormatter = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
});

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

  const eventItem = await prisma.eventItem.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      startAt: true,
      endAt: true,
      active: true,
      emailOnly: true,
      priceCents: true,
    },
  });

  if (!eventItem || !eventItem.active) {
    notFound();
  }

  const eventInstance = await prisma.eventInstance.findFirst({
    where: { slug },
    select: {
      id: true,
      allowEmailOnlyBooking: true,
    },
  });

  const tiers = eventInstance
    ? await prisma.product.findMany({
        where: {
          sourceType: 'event_instance_tier',
          sourceId: String(eventInstance.id),
          active: true,
        },
        select: {
          id: true,
          name: true,
          priceCents: true,
          order: true,
        },
        orderBy: [{ order: 'asc' }, { id: 'asc' }],
      })
    : [];

  const scheduleLabel = formatEventSchedule(eventItem.startAt, eventItem.endAt ?? undefined);
  const priceLabel = eventItem.priceCents > 0 ? currencyFormatter.format(eventItem.priceCents / 100) : null;
  const emailOnly = eventItem.emailOnly || eventInstance?.allowEmailOnlyBooking;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-gray-900">{eventItem.title}</h1>
        {scheduleLabel ? <p className="text-base text-gray-600">{scheduleLabel}</p> : null}
        {priceLabel ? (
          <p className="text-base font-medium text-gray-900">{priceLabel} a persona</p>
        ) : null}
      </header>

      {eventItem.description ? (
        <div className="mt-6 whitespace-pre-line text-base text-gray-700">{eventItem.description}</div>
      ) : null}

      {emailOnly ? (
        <section className="mt-10 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
          <h2 className="text-xl font-semibold text-gray-900">Prenota senza pagare</h2>
          <p className="mt-1 text-sm text-gray-600">
            Compila il modulo per ricevere la mail di conferma della tua prenotazione.
          </p>
          <div className="mt-6">
            <EventForm
              eventSlug={slug}
              tiers={
                tiers.length
                  ? tiers.map((tier) => ({
                      id: tier.id,
                      label: tier.name,
                      priceCents: tier.priceCents,
                    }))
                  : undefined
              }
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
