import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import SectionsPageClient from '@/components/admin/catalog/SectionsPageClient';
import { ToastProvider } from '@/components/admin/ui/toast';

export const dynamic = 'force-dynamic';

type SectionProductRow = {
  productId: number;
  productName: string;
  slug: string | null;
  priceCents: number;
  order: number;
  featured: boolean;
  showInHome: boolean;
};

type SectionEventRow = {
  eventId: string;
  title: string;
  slug: string;
  startAt: string;
  priceCents: number;
  order: number;
  featured: boolean;
  showInHome: boolean;
};

type SectionRow = {
  id: number;
  key: string;
  title: string;
  active: boolean;
  enableDateTime: boolean;
  displayOrder: number;
  products: SectionProductRow[];
  events: SectionEventRow[];
};

export default async function AdminCatalogSectionsPage() {
  await assertAdmin();

  const sections = await prisma.catalogSection.findMany({
    orderBy: { displayOrder: 'asc' },
  });
  const sectionIds = sections.map((s) => s.id);

  const links = sectionIds.length
    ? await prisma.sectionProduct.findMany({
        where: { sectionId: { in: sectionIds } },
        orderBy: [{ sectionId: 'asc' }, { order: 'asc' }],
      })
    : [];

  const eventLinks = sectionIds.length
    ? await prisma.sectionEventItem.findMany({
        where: { sectionId: { in: sectionIds } },
        orderBy: [{ sectionId: 'asc' }, { displayOrder: 'asc' }],
      })
    : [];

  const productIds = Array.from(new Set(links.map((l) => l.productId)));
  const products = productIds.length
    ? await prisma.product.findMany({
        where: { id: { in: productIds } },
        orderBy: [{ order: 'asc' }, { name: 'asc' }],
      })
    : [];

  const eventIds = Array.from(new Set(eventLinks.map((link) => link.eventItemId)));
  const events = eventIds.length
    ? await prisma.eventItem.findMany({
        where: { id: { in: eventIds } },
      })
    : [];

  const productById = new Map(products.map((p) => [p.id, p] as const));
  const eventById = new Map(events.map((event) => [event.id, event] as const));
  const linksBySection = new Map<number, typeof links>();
  const eventsBySection = new Map<number, typeof eventLinks>();

  for (const link of links) {
    const bucket = linksBySection.get(link.sectionId);
    if (bucket) bucket.push(link);
    else linksBySection.set(link.sectionId, [link]);
  }

  for (const link of eventLinks) {
    const bucket = eventsBySection.get(link.sectionId);
    if (bucket) bucket.push(link);
    else eventsBySection.set(link.sectionId, [link]);
  }

  const initialSections: SectionRow[] = sections.map((section) => {
    const sectionLinks = linksBySection.get(section.id) ?? [];
    const rows: SectionProductRow[] = sectionLinks
      .map((link) => {
        const product = productById.get(link.productId);
        return {
          productId: link.productId,
          productName: product?.name ?? `Prodotto #${link.productId}`,
          slug: product?.slug ?? null,
          priceCents: product?.priceCents ?? 0,
          order: link.order,
          featured: link.featured,
          showInHome: link.showInHome,
        };
      })
      .sort((a, b) =>
        a.order !== b.order
          ? a.order - b.order
          : a.productName.localeCompare(b.productName, 'it', { sensitivity: 'base' })
      );

    const sectionEventLinks = eventsBySection.get(section.id) ?? [];
    const eventRows: SectionEventRow[] = sectionEventLinks
      .map((link) => {
        const event = eventById.get(link.eventItemId);
        if (!event) return null;
        return {
          eventId: link.eventItemId,
          title: event.title,
          slug: event.slug,
          startAt: event.startAt.toISOString(),
          priceCents: event.priceCents,
          order: link.displayOrder,
          featured: link.featured,
          showInHome: link.showInHome,
        } satisfies SectionEventRow;
      })
      .filter((row): row is SectionEventRow => row !== null)
      .sort((a, b) => (a.order !== b.order ? a.order - b.order : a.title.localeCompare(b.title, 'it', { sensitivity: 'base' })));

    return {
      id: section.id,
      key: section.key,
      title: section.title,
      active: section.active,
      enableDateTime: section.enableDateTime,
      displayOrder: section.displayOrder,
      products: rows,
      events: eventRows,
    };
  });

  return (
    <ToastProvider>
      <SectionsPageClient initialSections={initialSections} />
    </ToastProvider>
  );
}
