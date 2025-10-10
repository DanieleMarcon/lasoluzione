import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';

type CatalogProductDTO = {
  type: 'product';
  id: number;
  slug: string;
  name: string;
  priceCents: number;
  imageUrl?: string;
  category?: string;
  order: number;
  active: boolean;
  isVegan: boolean;
  isVegetarian: boolean;
  isGlutenFree: boolean;
  isLactoseFree: boolean;
  isOrganic: boolean;
};

type CatalogEventDTO = {
  type: 'event';
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  flags: {
    emailOnly: boolean;
    featured: boolean;
    showInHome: boolean;
  };
};

type CatalogSectionDTO = {
  key: 'eventi' | 'aperitivo' | 'pranzo' | 'cena' | 'colazione';
  title: string;
  description?: string;
  enableDateTime: boolean;
  active: boolean;
  displayOrder: number;
  products: Array<CatalogProductDTO | CatalogEventDTO>;
};

type CatalogDTO = {
  sections: CatalogSectionDTO[];
};

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const sectionFilter = searchParams.get('section');

    const sections = await prisma.catalogSection.findMany({
      where: {
        active: true,
        ...(sectionFilter ? { key: sectionFilter } : {}),
      },
      orderBy: { displayOrder: 'asc' },
    });

    if (sections.length === 0) {
      const empty: CatalogDTO = { sections: [] };
      return NextResponse.json(empty);
    }

    const sectionIds = sections.map((section) => section.id);
    const sectionProducts = sectionIds.length
      ? await prisma.sectionProduct.findMany({
          where: { sectionId: { in: sectionIds } },
          orderBy: [{ sectionId: 'asc' }, { order: 'asc' }],
        })
      : [];

    const productIds = Array.from(new Set(sectionProducts.map((link) => link.productId)));
    const products = productIds.length
      ? await prisma.product.findMany({
          where: {
            id: { in: productIds },
            active: true,
          },
        })
      : [];

    const productMap = new Map(products.map((product) => [product.id, product] as const));
    const linksBySection = new Map<number, Array<(typeof sectionProducts)[number]>>();

    for (const link of sectionProducts) {
      if (!productMap.has(link.productId)) continue;
      const bucket = linksBySection.get(link.sectionId);
      if (bucket) {
        bucket.push(link);
      } else {
        linksBySection.set(link.sectionId, [link]);
      }
    }

    const eventSectionKeys = sections.filter((section) => section.key === 'eventi').map((section) => section.key);
    const eventsBySectionKey = new Map<string, CatalogEventDTO[]>();

    if (eventSectionKeys.length > 0) {
      const sectionEvents = await prisma.sectionEvent.findMany({
        where: { sectionId: { in: eventSectionKeys } },
        orderBy: [{ sectionId: 'asc' }, { order: 'asc' }],
      });

      const eventIds = Array.from(new Set(sectionEvents.map((link) => link.eventId)));
      const eventItems = eventIds.length
        ? await prisma.eventItem.findMany({
            where: {
              id: { in: eventIds },
              active: true,
            },
          })
        : [];

      const eventMap = new Map(eventItems.map((event) => [event.id, event] as const));

      for (const link of sectionEvents) {
        const event = eventMap.get(link.eventId);
        if (!event) continue;

        const dto: CatalogEventDTO = {
          type: 'event',
          id: event.id,
          slug: event.slug,
          title: event.title,
          priceCents: event.priceCents,
          flags: {
            emailOnly: event.emailOnly,
            featured: link.featured,
            showInHome: link.showInHome,
          },
        };

        const bucket = eventsBySectionKey.get(link.sectionId);
        if (bucket) {
          bucket.push(dto);
        } else {
          eventsBySectionKey.set(link.sectionId, [dto]);
        }
      }
    }

    const payload: CatalogDTO = {
      sections: sections.map((section) => {
        const links = linksBySection.get(section.id) ?? [];
        const sortedLinks = [...links].sort((a, b) => {
          if (a.order !== b.order) return a.order - b.order;
          const productA = productMap.get(a.productId);
          const productB = productMap.get(b.productId);
          const nameA = productA?.name ?? '';
          const nameB = productB?.name ?? '';
          return nameA.localeCompare(nameB, 'it', { sensitivity: 'base' });
        });

        if (section.key === 'eventi') {
          const events = eventsBySectionKey.get(section.key) ?? [];
          return {
            key: section.key as CatalogSectionDTO['key'],
            title: section.title,
            description: section.description ?? undefined,
            enableDateTime: section.enableDateTime,
            active: section.active,
            displayOrder: section.displayOrder,
            products: events,
          } satisfies CatalogSectionDTO;
        }

        const productsDTO = sortedLinks
          .map((link) => {
            const product = productMap.get(link.productId);
            if (!product) return null;
            return {
              type: 'product' as const,
              id: product.id,
              slug: product.slug,
              name: product.name,
              priceCents: product.priceCents,
              imageUrl: product.imageUrl ?? undefined,
              category: product.category ?? undefined,
              order: link.order,
              active: product.active,
              isVegan: product.isVegan,
              isVegetarian: product.isVegetarian,
              isGlutenFree: product.isGlutenFree,
              isLactoseFree: product.isLactoseFree,
              isOrganic: product.isOrganic,
            } satisfies CatalogProductDTO;
          })
          .filter((item): item is CatalogProductDTO => item !== null);

        return {
          key: section.key as CatalogSectionDTO['key'],
          title: section.title,
          description: section.description ?? undefined,
          enableDateTime: section.enableDateTime,
          active: section.active,
          displayOrder: section.displayOrder,
          products: productsDTO,
        } satisfies CatalogSectionDTO;
      }),
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('[GET /api/catalog] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
