// src/app/api/admin/events/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import { toAdminEventDTO, toAdminEventListDTO } from '@/lib/admin/events-dto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_PAGE_SIZE = 10;
const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const querySchema = z.object({
  search: z.string().trim().optional(),
  active: z.enum(['all', 'true', 'false']).optional(),
  page: z.coerce.number().int().min(1).optional(),
  size: z.coerce.number().int().min(1).max(100).optional(),
});

const isoStringSchema = z
  .string({ required_error: 'Data obbligatoria' })
  .trim()
  .refine((value) => !Number.isNaN(new Date(value).getTime()), {
    message: 'Formato data non valido',
  });

const createSchema = z.object({
  slug: z
    .string({ required_error: 'Slug obbligatorio' })
    .trim()
    .min(3)
    .max(100)
    .regex(SLUG_REGEX, { message: 'Usa lettere minuscole, numeri e trattini' }),
  title: z.string({ required_error: 'Titolo obbligatorio' }).trim().min(3),
  description: z.string().trim().max(2000).optional().nullable(),
  startAt: isoStringSchema,
  endAt: isoStringSchema.optional().nullable(),
  active: z.boolean({ required_error: 'Stato obbligatorio' }),
  showOnHome: z.boolean({ required_error: 'Visibilità obbligatoria' }),
  allowEmailOnlyBooking: z.boolean({ required_error: 'Flag email-only obbligatorio' }),
  capacity: z.number().int().min(1).optional().nullable(),
});

async function resolveDefaultEventProductId() {
  const preferred = await prisma.product.findFirst({
    where: { category: 'evento' },
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  if (preferred) return preferred.id;
  const fallback = await prisma.product.findFirst({
    orderBy: { id: 'asc' },
    select: { id: true },
  });
  return fallback?.id ?? null;
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

  const where: Parameters<typeof prisma.eventInstance.findMany>[0]['where'] = {};

  if (search) {
    where.OR = [
      { title: { contains: search } },
      { slug: { contains: search } },
    ];
  }

  if (activeFilter === 'true') where.active = true;
  else if (activeFilter === 'false') where.active = false;

  const total = await prisma.eventInstance.count({ where });
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const page = Math.min(requestedPage, totalPages);
  const skip = (page - 1) * pageSize;

  const items = await prisma.eventInstance.findMany({
    where,
    orderBy: { startAt: 'asc' },
    skip,
    take: pageSize,
  });

  return NextResponse.json({
    ok: true,
    data: toAdminEventListDTO(items),
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

  const slug = payload.slug;
  const existingSlug = await prisma.eventInstance.findUnique({ where: { slug } });
  if (existingSlug) {
    return NextResponse.json(
      { ok: false, error: 'slug_conflict', message: 'Slug già in uso' },
      { status: 409 },
    );
  }

  const startDate = new Date(payload.startAt);
  if (Number.isNaN(startDate.getTime())) {
    return NextResponse.json(
      { ok: false, error: 'invalid_start', message: 'Data di inizio non valida' },
      { status: 400 },
    );
  }

  let endDate: Date | null = null;
  if (payload.endAt) {
    endDate = new Date(payload.endAt);
    if (Number.isNaN(endDate.getTime())) {
      return NextResponse.json(
        { ok: false, error: 'invalid_end', message: 'Data di fine non valida' },
        { status: 400 },
      );
    }
    if (endDate <= startDate) {
      return NextResponse.json(
        { ok: false, error: 'invalid_range', message: 'La fine deve essere successiva all\'inizio' },
        { status: 400 },
      );
    }
  }

  const productId = await resolveDefaultEventProductId();
  if (!productId) {
    return NextResponse.json(
      {
        ok: false,
        error: 'missing_product',
        message: 'Configura almeno un prodotto prima di creare eventi',
      },
      { status: 400 },
    );
  }

  const created = await prisma.eventInstance.create({
    data: {
      slug,
      title: payload.title.trim(),
      description: payload.description?.trim() ? payload.description.trim() : null,
      startAt: startDate,
      endAt: endDate,
      active: payload.active,
      showOnHome: payload.showOnHome,
      allowEmailOnlyBooking: payload.allowEmailOnlyBooking,
      capacity: payload.capacity ?? null,
      productId,
    },
  });

  return NextResponse.json({ ok: true, data: toAdminEventDTO(created) }, { status: 201 });
}
