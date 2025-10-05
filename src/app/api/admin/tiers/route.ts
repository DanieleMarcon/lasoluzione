// src/app/api/admin/tiers/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma, EventTier } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { assertAdmin } from '@/lib/admin/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const tierTypeSchema = z.enum(['evento', 'aperitivo']);

const createSchema = z.object({
  id: z.string().trim().min(1).optional(),
  type: tierTypeSchema,
  label: z.string().trim().min(2, 'Etichetta troppo corta'),
  priceCents: z.coerce.number().int().min(0),
  order: z.coerce.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function formatTier(tier: EventTier) {
  return {
    id: tier.id,
    type: tier.type as 'evento' | 'aperitivo',
    label: tier.label,
    priceCents: tier.priceCents,
    order: tier.order,
    active: tier.active,
  };
}

export async function GET(request: Request) {
  await assertAdmin();

  const { searchParams } = new URL(request.url);
  const typeParam = searchParams.get('type');
  const query = searchParams.get('q');
  const pageParam = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const sizeParam = Number.parseInt(searchParams.get('pageSize') ?? '20', 10);

  const page = Number.isFinite(pageParam) && pageParam > 0 ? pageParam : 1;
  const rawPageSize = Number.isFinite(sizeParam) && sizeParam > 0 ? sizeParam : 20;
  const pageSize = Math.min(100, rawPageSize);

  const where: Prisma.EventTierWhereInput = {};

  if (typeParam === 'evento' || typeParam === 'aperitivo') {
    where.type = typeParam;
  }

  if (query) {
    where.label = { contains: query };
  }

  const total = await prisma.eventTier.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);
  const skip = (currentPage - 1) * pageSize;

  const tiers = await prisma.eventTier.findMany({
    where,
    skip,
    take: pageSize,
    orderBy: [{ type: 'asc' }, { order: 'asc' }, { label: 'asc' }],
  });

  return NextResponse.json({
    ok: true,
    data: tiers.map(formatTier),
    meta: { page: currentPage, pageSize, total, totalPages },
  });
}

export async function POST(request: Request) {
  await assertAdmin();

  let payload: z.infer<typeof createSchema>;
  try {
    payload = createSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'validation_error', details: error.flatten() },
        { status: 400 },
      );
    }
    throw error;
  }

  const baseSlug = slugify(payload.label);
  if (!baseSlug) {
    return NextResponse.json({ ok: false, error: 'invalid_label' }, { status: 400 });
  }

  const tierId = payload.id ?? `${payload.type}-${baseSlug}`;

  const existing = await prisma.eventTier.findUnique({ where: { id: tierId } });
  if (existing) {
    return NextResponse.json({ ok: false, error: 'id_conflict' }, { status: 409 });
  }

  try {
    const created = await prisma.eventTier.create({
      data: {
        id: tierId,
        type: payload.type,
        label: payload.label,
        priceCents: payload.priceCents,
        order: payload.order ?? 0,
        active: payload.active ?? true,
      },
    });

    return NextResponse.json({ ok: true, data: formatTier(created) }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ ok: false, error: 'id_conflict' }, { status: 409 });
    }
    console.error('[admin][tiers][POST]', error);
    return NextResponse.json({ ok: false, error: 'creation_failed' }, { status: 500 });
  }
}
