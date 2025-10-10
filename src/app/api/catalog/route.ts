import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import type { CatalogDTO, CatalogSectionDTO } from '@/types/catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sections = await prisma.catalogSection.findMany({
      where: { active: true },
      orderBy: { displayOrder: 'asc' },
    });

    if (sections.length === 0) {
      const empty: CatalogDTO = { sections: [] };
      return NextResponse.json(empty);
    }

    const sectionIds = sections.map((section) => section.id);
    const sectionProducts = await prisma.sectionProduct.findMany({
      where: { sectionId: { in: sectionIds } },
      orderBy: [{ sectionId: 'asc' }, { order: 'asc' }],
    });

    const productIds = Array.from(new Set(sectionProducts.map((link) => link.productId)));
    const products = productIds.length
      ? await prisma.product.findMany({
          where: {
            id: { in: productIds },
            active: true,
          },
        })
      : [];

    const emailOnlyProductIds = new Set<number>();
    if (productIds.length) {
      const emailOnlyInstances = await prisma.eventInstance.findMany({
        where: {
          productId: { in: productIds },
          allowEmailOnlyBooking: true,
        },
        select: { productId: true },
      });

      for (const row of emailOnlyInstances) {
        emailOnlyProductIds.add(row.productId);
      }
    }

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

    const payload: CatalogDTO = {
      sections: sections.map((section): CatalogSectionDTO => {
        const links = linksBySection.get(section.id) ?? [];
        const sortedLinks = [...links].sort((a, b) => {
          if (a.order !== b.order) return a.order - b.order;
          const productA = productMap.get(a.productId);
          const productB = productMap.get(b.productId);
          const nameA = productA?.name ?? '';
          const nameB = productB?.name ?? '';
          return nameA.localeCompare(nameB, 'it', { sensitivity: 'base' });
        });

        const productsDTO = sortedLinks
          .map((link) => {
            const product = productMap.get(link.productId);
            if (!product) return null;
            if (section.key === 'eventi' && emailOnlyProductIds.has(link.productId)) {
              return null;
            }
            return {
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
            };
          })
          .filter((item): item is NonNullable<typeof item> => item !== null);

        return {
          key: section.key as CatalogSectionDTO['key'],
          title: section.title,
          description: section.description ?? undefined,
          enableDateTime: section.enableDateTime,
          active: section.active,
          displayOrder: section.displayOrder,
          products: productsDTO,
        };
      }),
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('[GET /api/catalog] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
