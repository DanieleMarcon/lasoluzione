// src/app/api/admin/events/route.ts
import { NextResponse } from 'next/server';
import type { EventItem } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import { prismaHasEventItem } from '@/utils/dev-guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_PAGE_SIZE = 10;

const querySchema = z.object({
  search: z.string().trim().optional(),
  active: z.enum(['all', 'true', 'false']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  size: z.coerce.number().int().min(1).max(100).optional(),
});

const bodySchema = z.object({
  title: z.string().trim().min(2),
  slug: z.string().trim().min(2),
  description: z.string().optional().nullable(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date().optional().nullable(),
  price: z.union([z.number(), z.string()]).optional(),
  priceCents: z.number().int().nonnegative().optional(),
  allowEmailOnlyBooking: z.boolean().default(false),
  showOnHome: z.boolean().default(false),
  active: z.boolean().default(true),
  capacity: z.number().int().min(1).optional().nullable(),
});

function euroLikeToCents(v?: number | string): number {
  if (v === undefined) return 0;
  if (typeof v === 'number') return Math.round(v * 100);
  const norm = v.replace(/\./g, '').replace(',', '.');
  const n = Number(norm);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

function toAdminEventItemDTO(event: EventItem) {
  return {
    id: event.id,
    slug: event.slug,
    title: event.title,
    description: event.description ?? null,
    startAt: event.startAt.toISOString(),
    endAt: event.endAt ? event.endAt.toISOString() : null,
    active: event.active,
    showOnHome: event.showOnHome,
    emailOnly: event.emailOnly,
    capacity: event.capacity ?? null,
    priceCents: event.priceCents,
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  };
}

export async function GET(request: Request) {
  await assertAdmin();

  const { searchParams } = new URL(request.url);
  const parsedQuery = querySchema.safeParse({
    search: searchParams.get('search') ?? undefined,
    active: searchParams.get('active') ?? undefined,
    page: searchParams.get('page') ?? undefined,
    size: searchParams.get('size') ?? undefined,
  });

  if (!parsedQuery.success) {
    return NextResponse.json({ ok: false, error: 'invalid_query' }, { status: 400 });
  }

  const search = parsedQuery.data.search ?? '';
  const activeFilter = parsedQuery.data.active ?? 'all';
  const requestedPage = parsedQuery.data.page ?? 1;
  const pageSize = parsedQuery.data.size ?? DEFAULT_PAGE_SIZE;

  const where: Prisma.EventItemWhereInput = {};

  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { slug: { contains: search, mode: 'insensitive' } },
    ];
  }

  if (activeFilter === 'true') where.active = true;
  else if (activeFilter === 'false') where.active = false;

  const total = await prisma.eventItem.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * pageSize;

  const items = await prisma.eventItem.findMany({
    where,
    orderBy: { startAt: 'asc' },
    skip,
    take: pageSize,
  });

  return NextResponse.json({
    ok: true,
    data: items.map(toAdminEventItemDTO),
    meta: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  });
}

export async function POST(request: Request) {
  await assertAdmin();

  if (!prismaHasEventItem()) {
    return NextResponse.json(
      {
        ok: false,
        error: 'missing_eventitem_model',
        message: 'Prisma client senza EventItem. Esegui migrate + generate.',
      },
      { status: 503 },
    );
  }

  const rawPayload = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(rawPayload);

  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, error: 'payload_non_valido', details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const {
    title,
    slug,
    description,
    startAt,
    endAt,
    price,
    priceCents,
    allowEmailOnlyBooking,
    showOnHome,
    active,
    capacity,
  } = parsed.data;

  if (endAt && endAt <= startAt) {
    return NextResponse.json(
      {
        ok: false,
        error: 'invalid_range',
        message: 'La data di fine deve essere successiva a quella di inizio.',
      },
      { status: 400 },
    );
  }

  const cents = priceCents ?? euroLikeToCents(price);

  try {
    const created = await prisma.eventItem.create({
      data: {
        slug: slug.trim(),
        title: title.trim(),
        description: description?.trim() ? description.trim() : null,
        startAt,
        endAt: endAt ?? null,
        active,
        showOnHome,
        emailOnly: allowEmailOnlyBooking,
        capacity: capacity ?? null,
        priceCents: cents,
      },
    });

    return NextResponse.json({ ok: true, data: toAdminEventItemDTO(created) }, { status: 201 });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json(
        { ok: false, error: 'slug_conflict', message: 'Slug già in uso' },
        { status: 409 },
      );
    }

    console.error('[POST /api/admin/events] error', error);
    return NextResponse.json(
      { ok: false, error: 'create_failed', message: 'Impossibile creare evento' },
      { status: 500 },
    );
  }
}
