// src/app/api/admin/events/route.ts
import { NextResponse } from 'next/server';
import type { EventItem } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import { eventItemCreateSchema } from '@/lib/validators/eventItem';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_PAGE_SIZE = 10;

const querySchema = z.object({
  search: z.string().trim().optional(),
  active: z.enum(['all', 'true', 'false']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  size: z.coerce.number().int().min(1).max(100).optional(),
});

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

  let payload: z.infer<typeof eventItemCreateSchema>;
  try {
    payload = eventItemCreateSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'validation_error', details: error.flatten() },
        { status: 400 },
      );
    }
    throw error;
  }

  const existingSlug = await prisma.eventItem.findUnique({ where: { slug: payload.slug } });
  if (existingSlug) {
    return NextResponse.json(
      { ok: false, error: 'slug_conflict', message: 'Slug già in uso' },
      { status: 409 },
    );
  }

  const startDate = new Date(payload.startAt);
  const endDate = payload.endAt ? new Date(payload.endAt) : null;

  if (Number.isNaN(startDate.getTime())) {
    return NextResponse.json(
      { ok: false, error: 'invalid_start', message: 'Data di inizio non valida' },
      { status: 400 },
    );
  }

  if (endDate && Number.isNaN(endDate.getTime())) {
    return NextResponse.json(
      { ok: false, error: 'invalid_end', message: 'Data di fine non valida' },
      { status: 400 },
    );
  }

  if (endDate && endDate <= startDate) {
    return NextResponse.json(
      { ok: false, error: 'invalid_range', message: 'La fine deve essere successiva all\'inizio' },
      { status: 400 },
    );
  }

  const created = await prisma.eventItem.create({
    data: {
      slug: payload.slug,
      title: payload.title.trim(),
      description: payload.description?.trim() ? payload.description.trim() : null,
      startAt: startDate,
      endAt: endDate,
      active: payload.active,
      showOnHome: payload.showOnHome,
      emailOnly: payload.emailOnly,
      capacity: payload.capacity ?? null,
      priceCents: payload.priceCents,
    },
  });

  return NextResponse.json({ ok: true, data: toAdminEventItemDTO(created) }, { status: 201 });
}
