import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { prismaHasEventItem } from '@/utils/dev-guards';

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
  startAt: string;
  endAt: string | null;
  order: number;
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
  if (!prismaHasEventItem()) {
    return NextResponse.json(
      { error: 'Prisma client senza EventItem: esegui migrate + generate' },
      { status: 503 }
    );
  }

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

    const sectionEventItems = sectionIds.length
      ? await prisma.sectionEventItem.findMany({
          where: { sectionId: { in: sectionIds } },
          orderBy: [{ sectionId: 'asc' }, { displayOrder: 'asc' }],
          include: { eventItem: true },
        })
      : [];

    const eventsBySectionId = new Map<number, CatalogEventDTO[]>();

    for (const link of sectionEventItems) {
      if (!link.eventItem.active) continue;
      const dto: CatalogEventDTO = {
        type: 'event',
        id: link.eventItem.id,
        slug: link.eventItem.slug,
        title: link.eventItem.title,
        priceCents: link.eventItem.priceCents,
        startAt: link.eventItem.startAt.toISOString(),
        endAt: link.eventItem.endAt ? link.eventItem.endAt.toISOString() : null,
        order: link.displayOrder,
        flags: {
          emailOnly: link.eventItem.emailOnly,
          featured: link.featured,
          showInHome: link.showInHome,
        },
      } satisfies CatalogEventDTO;

      const bucket = eventsBySectionId.get(link.sectionId);
      if (bucket) bucket.push(dto);
      else eventsBySectionId.set(link.sectionId, [dto]);
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
          const events = eventsBySectionId.get(section.id) ?? [];
          const sortedEvents = [...events].sort((a, b) =>
            a.order !== b.order ? a.order - b.order : a.title.localeCompare(b.title, 'it', { sensitivity: 'base' })
          );
          return {
            key: section.key as CatalogSectionDTO['key'],
            title: section.title,
            description: section.description ?? undefined,
            enableDateTime: section.enableDateTime,
            active: section.active,
            displayOrder: section.displayOrder,
            products: sortedEvents,
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
