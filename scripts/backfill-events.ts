import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function upsertEventItems() {
  const eventInstances = await prisma.eventInstance.findMany({
    include: {
      product: true,
    },
  });

  const eventItemsBySlug = new Map<string, { id: string }>();
  const productIdToEventSlug = new Map<number, string>();

  for (const instance of eventInstances) {
    const priceCents = instance.product?.priceCents ?? 0;

    const eventItem = await prisma.eventItem.upsert({
      where: { slug: instance.slug },
      update: {
        title: instance.title,
        description: instance.description ?? null,
        startAt: instance.startAt,
        endAt: instance.endAt,
        active: instance.active,
        showOnHome: instance.showOnHome,
        capacity: instance.capacity,
        priceCents,
        emailOnly: instance.allowEmailOnlyBooking,
      },
      create: {
        slug: instance.slug,
        title: instance.title,
        description: instance.description ?? null,
        startAt: instance.startAt,
        endAt: instance.endAt,
        active: instance.active,
        showOnHome: instance.showOnHome,
        capacity: instance.capacity,
        priceCents,
        emailOnly: instance.allowEmailOnlyBooking,
      },
    });

    eventItemsBySlug.set(eventItem.slug, eventItem);
    productIdToEventSlug.set(instance.productId, eventItem.slug);
  }

  return { eventItemsBySlug, productIdToEventSlug };
}

async function syncSectionEvents(eventItemsBySlug: Map<string, { id: string }>, productIdToEventSlug: Map<number, string>) {
  const section = await prisma.catalogSection.findUnique({
    where: { key: 'eventi' },
    include: {
      products: {
        include: {
          product: true,
        },
      },
    },
  });

  if (!section) {
    console.warn("Catalog section with key 'eventi' not found. Skipping SectionEvent backfill.");
    return;
  }

  for (const sectionProduct of section.products) {
    const fallbackSlug = sectionProduct.product.slug;
    const eventSlug = productIdToEventSlug.get(sectionProduct.productId) ?? fallbackSlug;
    const eventItem = eventItemsBySlug.get(eventSlug);

    if (!eventItem) {
      continue;
    }

    await prisma.sectionEvent.upsert({
      where: {
        sectionId_eventId: {
          sectionId: section.key,
          eventId: eventItem.id,
        },
      },
      update: {
        order: sectionProduct.order,
        featured: sectionProduct.featured,
        showInHome: sectionProduct.showInHome,
      },
      create: {
        sectionId: section.key,
        eventId: eventItem.id,
        order: sectionProduct.order,
        featured: sectionProduct.featured,
        showInHome: sectionProduct.showInHome,
      },
    });
  }
}

async function main() {
  try {
    const { eventItemsBySlug, productIdToEventSlug } = await upsertEventItems();
    await syncSectionEvents(eventItemsBySlug, productIdToEventSlug);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
