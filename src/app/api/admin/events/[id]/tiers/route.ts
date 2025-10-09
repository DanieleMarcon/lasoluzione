// src/app/api/admin/events/[id]/tiers/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  id: z.string(),
});

const createSchema = z.object({
  label: z.string().trim().min(2),
  description: z.string().trim().max(2000).optional().nullable(),
  priceCents: z.coerce.number().int().min(0),
  order: z.coerce.number().int(),
  active: z.boolean(),
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function formatTier(product: {
  id: number;
  name: string;
  description: string | null;
  priceCents: number;
  order: number;
  active: boolean;
}) {
  return {
    id: product.id,
    label: product.name,
    description: product.description ?? null,
    priceCents: product.priceCents,
    order: product.order,
    active: product.active,
  };
}

async function ensureEvent(eventId: number) {
  const event = await prisma.eventInstance.findUnique({ where: { id: eventId } });
  return event;
}

async function generateUniqueSlug(eventSlug: string, label: string) {
  const base = slugify(label) || `pacchetto-${Date.now()}`;
  let candidate = `event-${eventSlug}-${base}`.slice(0, 120);
  let attempt = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const existing = await prisma.product.findUnique({ where: { slug: candidate } });
    if (!existing) {
      return candidate;
    }
    attempt += 1;
    candidate = `event-${eventSlug}-${base}-${attempt}`.slice(0, 120);
  }
}

export async function GET(request: Request, context: { params: { id: string } }) {
  await assertAdmin();

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }

  const eventId = Number.parseInt(parsedParams.data.id, 10);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }

  const event = await ensureEvent(eventId);
  if (!event) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const products = await prisma.product.findMany({
    where: { sourceType: 'event_instance_tier', sourceId: String(eventId) },
    orderBy: [{ order: 'asc' }, { id: 'asc' }],
  });

  return NextResponse.json({ ok: true, data: products.map(formatTier) });
}

export async function POST(request: Request, context: { params: { id: string } }) {
  await assertAdmin();

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }

  const eventId = Number.parseInt(parsedParams.data.id, 10);
  if (!Number.isInteger(eventId) || eventId <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }

  const event = await ensureEvent(eventId);
  if (!event) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

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

  const slug = await generateUniqueSlug(event.slug, payload.label);

  try {
    const trimmedDescription =
      payload.description == null ? null : payload.description.trim() || null;

    const created = await prisma.product.create({
      data: {
        slug,
        name: payload.label,
        description: trimmedDescription,
        priceCents: payload.priceCents,
        unitCostCents: 0,
        supplierName: null,
        stockQty: 0,
        imageUrl: null,
        ingredients: null,
        allergens: null,
        category: 'evento',
        order: payload.order,
        active: payload.active,
        sourceType: 'event_instance_tier',
        sourceId: String(eventId),
        isVegan: false,
        isVegetarian: false,
        isGlutenFree: false,
        isLactoseFree: false,
        isOrganic: false,
      },
    });

    return NextResponse.json({ ok: true, data: formatTier(created) }, { status: 201 });
  } catch (error: unknown) {
    if (typeof error === 'object' && error && 'code' in error) {
      const known = error as { code?: string };
      if (known.code === 'P2002') {
        return NextResponse.json({ ok: false, error: 'slug_conflict' }, { status: 409 });
      }
    }
    console.error('[admin][events][tiers][POST]', error);
    return NextResponse.json({ ok: false, error: 'creation_failed' }, { status: 500 });
  }
}
