// src/app/api/admin/products/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { assertAdmin } from '@/lib/admin/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const createSchema = z.object({
  name: z.string().trim().min(2),
  slug: z.string().trim().min(1).optional(),
  description: z.string().trim().optional(),
  ingredients: z.string().trim().optional(),
  allergens: z.string().trim().optional(),
  priceCents: z.coerce.number().int().min(0),
  unitCostCents: z.coerce.number().int().min(0).optional().default(0),
  supplierName: z.string().trim().optional(),
  stockQty: z.coerce.number().int().min(0).optional().default(0),
  imageUrl: z.string().trim().url().optional(),
  category: z.string().trim().optional(),
  order: z.coerce.number().int().min(0).optional().default(0),
  active: z.boolean().optional().default(true),
  isVegan: z.boolean().optional().default(false),
  isVegetarian: z.boolean().optional().default(false),
  isGlutenFree: z.boolean().optional().default(false),
  isLactoseFree: z.boolean().optional().default(false),
  isOrganic: z.boolean().optional().default(false),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export async function GET(request: Request) {
  await assertAdmin();

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get('q') ?? '').trim();
  const activeParam = searchParams.get('active'); // 'true' | 'false' | 'all' | null
  const category = (searchParams.get('category') ?? '').trim() || undefined;

  const pageParam = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const sizeParam = Number.parseInt(searchParams.get('pageSize') ?? '20', 10);

  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const rawPageSize = Number.isFinite(sizeParam) && sizeParam > 0 ? sizeParam : 20;
  const pageSize = Math.min(100, rawPageSize);

  const where: Prisma.ProductWhereInput = {};

  if (q) {
    // Niente `mode: 'insensitive'` in SQLite: usiamo contains semplice.
    where.OR = [
      { name: { contains: q } },
      { slug: { contains: q } },
    ];
  }

  if (category) {
    where.category = { equals: category };
  }

  if (activeParam === 'true') where.active = true;
  else if (activeParam === 'false') where.active = false;
  // 'all' o null -> non filtriamo per active

  const total = await prisma.product.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const skip = (currentPage - 1) * pageSize;

  const items = await prisma.product.findMany({
    where,
    skip,
    take: pageSize,
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
  });

  return NextResponse.json({
    ok: true,
    data: items,
    meta: { page: currentPage, pageSize, total, totalPages },
  });
}

export async function POST(request: Request) {
  await assertAdmin();

  let payload: z.infer<typeof createSchema>;
  try {
    payload = createSchema.parse(await request.json());
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: 'validation_error', details: err.flatten() }, { status: 400 });
    }
    throw err;
  }

  const slug = (payload.slug && payload.slug.trim()) || slugify(payload.name);
  if (!slug) {
    return NextResponse.json({ ok: false, error: 'invalid_slug' }, { status: 400 });
  }

  const exists = await prisma.product.findUnique({ where: { slug } });
  if (exists) {
    return NextResponse.json({ ok: false, error: 'slug_conflict' }, { status: 409 });
  }

  const created = await prisma.product.create({
    data: {
      name: payload.name,
      slug,
      description: payload.description || null,
      ingredients: payload.ingredients || null,
      allergens: payload.allergens || null,
      priceCents: payload.priceCents,
      unitCostCents: payload.unitCostCents ?? 0,
      supplierName: payload.supplierName || null,
      stockQty: payload.stockQty ?? 0,
      imageUrl: payload.imageUrl || null,
      category: payload.category || null,
      order: payload.order ?? 0,
      active: payload.active ?? true,
      isVegan: payload.isVegan ?? false,
      isVegetarian: payload.isVegetarian ?? false,
      isGlutenFree: payload.isGlutenFree ?? false,
      isLactoseFree: payload.isLactoseFree ?? false,
      isOrganic: payload.isOrganic ?? false,
    },
  });

  return NextResponse.json({ ok: true, data: created }, { status: 201 });
}
