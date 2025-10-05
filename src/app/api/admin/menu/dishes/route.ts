// src/app/api/admin/menu/dishes/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { assertAdmin } from '@/lib/admin/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

const visibleAtEnum = z.enum(['lunch', 'dinner', 'both']);

const createSchema = z.object({
  name: z.string().trim().min(2, 'Nome troppo corto'),
  slug: z.string().trim().min(1).optional(),
  description: z.string().trim().max(500).optional(),
  priceCents: z.coerce.number().int().min(0).default(0),
  active: z.boolean().optional(),
  category: z.string().trim().max(80).optional().nullable(),
  order: z.coerce.number().int().min(0).default(0),
  visibleAt: visibleAtEnum.default('both'),
});

async function findSlugConflict(slug: string, excludeId?: number) {
  const lower = slug.toLowerCase();
  const existing = await prisma.menuDish.findMany({
    where: excludeId ? { id: { not: excludeId } } : undefined,
    select: { id: true, slug: true },
  });
  return existing.find((dish) => dish.slug.toLowerCase() === lower);
}

export async function GET(request: Request) {
  await assertAdmin();

  const { searchParams } = new URL(request.url);
  const activeParam = searchParams.get('active');
  const category = searchParams.get('category');
  const search = searchParams.get('q');
  const pageParam = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const sizeParam = Number.parseInt(searchParams.get('pageSize') ?? '20', 10);
  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const pageSizeRaw = Number.isFinite(sizeParam) && sizeParam > 0 ? sizeParam : 20;
  const pageSize = Math.min(100, pageSizeRaw);

  const where: Prisma.MenuDishWhereInput = {};

  if (activeParam === 'true') {
    where.active = true;
  } else if (activeParam === 'false') {
    where.active = false;
  }

  if (category) {
    where.category = category;
  }

  if (search) {
    where.OR = [
      { name: { contains: search } },
      { description: { contains: search } },
    ];
  }

  const total = await prisma.menuDish.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const skip = (currentPage - 1) * pageSize;

  const dishes = await prisma.menuDish.findMany({
    where,
    skip,
    take: pageSize,
    orderBy: [
      { order: 'asc' },
      { category: 'asc' },
      { name: 'asc' },
    ],
  });

  return NextResponse.json({
    ok: true,
    data: dishes.map((dish) => ({
      id: dish.id,
      name: dish.name,
      slug: dish.slug,
      description: dish.description,
      priceCents: dish.priceCents,
      active: dish.active,
      category: dish.category,
      order: dish.order,
      visibleAt: (dish as any).visibleAt ?? 'both',
      createdAt: dish.createdAt.toISOString(),
      updatedAt: dish.updatedAt.toISOString(),
    })),
    page: currentPage,
    pageSize,
    total,
    totalPages,
  });
}

export async function POST(request: Request) {
  await assertAdmin();

  let payload;
  try {
    payload = createSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dati non validi', details: error.flatten() }, { status: 400 });
    }
    throw error;
  }

  const baseSlug = payload.slug && payload.slug.length ? payload.slug : payload.name;
  const safeSlug = slugify(baseSlug);
  if (!safeSlug) {
    return NextResponse.json({ error: 'Slug non valido' }, { status: 400 });
  }

  const conflict = await findSlugConflict(safeSlug);
  if (conflict) {
    return NextResponse.json({ ok: false, error: 'slug_conflict' }, { status: 409 });
  }

  try {
    const created = await prisma.menuDish.create({
      data: {
        name: payload.name,
        slug: safeSlug,
        description: payload.description ?? null,
        priceCents: payload.priceCents,
        active: payload.active ?? true,
        category: payload.category ?? null,
        order: payload.order,
        visibleAt: payload.visibleAt,
      },
    });
    return NextResponse.json({ ok: true, data: created }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Slug già in uso' }, { status: 409 });
    }
    console.error('[admin][menu dishes][POST]', error);
    return NextResponse.json({ error: 'Impossibile creare il piatto' }, { status: 500 });
  }
}
