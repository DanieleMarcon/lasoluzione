// src/app/api/admin/menu/dishes/[id]/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { assertAdmin } from '@/lib/admin/session';

async function findSlugConflict(slug: string, excludeId: number) {
  const lower = slug.toLowerCase();
  const existing = await prisma.menuDish.findMany({
    where: { id: { not: excludeId } },
    select: { id: true, slug: true },
  });
  return existing.find((dish) => dish.slug.toLowerCase() === lower);
}

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

const idSchema = z.object({
  id: z
    .string()
    .transform((value) => Number.parseInt(value, 10))
    .refine((value) => Number.isInteger(value) && value > 0, 'ID non valido'),
});

const visibleAtEnum = z.enum(['lunch', 'dinner', 'both']);

const updateSchema = z
  .object({
    name: z.string().trim().min(2).optional(),
    slug: z.string().trim().min(1).optional(),
    description: z.string().trim().max(500).optional().nullable(),
    priceCents: z.coerce.number().int().min(0).optional(),
    active: z.boolean().optional(),
    category: z.string().trim().max(80).optional().nullable(),
    order: z.coerce.number().int().min(0).optional(),
    visibleAt: visibleAtEnum.optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: 'Nessun campo da aggiornare',
  });

export async function PATCH(request: Request, context: { params: { id: string } }) {
  await assertAdmin();

  const { id } = idSchema.parse(context.params);

  const existing = await prisma.menuDish.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: 'Piatto non trovato' }, { status: 404 });
  }

  let payload;
  try {
    payload = updateSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Dati non validi', details: error.flatten() }, { status: 400 });
    }
    throw error;
  }

  const data: Record<string, unknown> = {};
  if (payload.name !== undefined) data.name = payload.name;
  if (payload.description !== undefined) data.description = payload.description ?? null;
  if (payload.priceCents !== undefined) data.priceCents = payload.priceCents;
  if (payload.active !== undefined) data.active = payload.active;
  if (payload.category !== undefined) data.category = payload.category ?? null;
  if (payload.order !== undefined) data.order = payload.order;
  if (payload.visibleAt !== undefined) data.visibleAt = payload.visibleAt;
  let safeSlug: string | null = null;
  if (payload.slug !== undefined) {
    safeSlug = slugify(payload.slug);
    if (!safeSlug) {
      return NextResponse.json({ error: 'Slug non valido' }, { status: 400 });
    }
  } else if (payload.name !== undefined && payload.name.trim() !== existing.name) {
    safeSlug = slugify(payload.name);
  }

  if (safeSlug && safeSlug !== existing.slug) {
    const conflict = await findSlugConflict(safeSlug, id);
    if (conflict) {
      return NextResponse.json({ ok: false, error: 'slug_conflict' }, { status: 409 });
    }
    data.slug = safeSlug;
  }

  try {
    const updated = await prisma.menuDish.update({ where: { id }, data });
    return NextResponse.json({ ok: true, data: updated });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ error: 'Slug già in uso' }, { status: 409 });
    }
    console.error('[admin][menu dishes][PATCH]', error);
    return NextResponse.json({ error: 'Impossibile aggiornare il piatto' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: { id: string } }) {
  await assertAdmin();

  const { id } = idSchema.parse(context.params);
  const { searchParams } = new URL(request.url);
  const hardDelete = searchParams.get('hard') === 'true';

  try {
    if (hardDelete) {
      await prisma.menuDish.delete({ where: { id } });
    } else {
      await prisma.menuDish.update({ where: { id }, data: { active: false } });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin][menu dishes][DELETE]', error);
    return NextResponse.json({ error: 'Impossibile eliminare il piatto' }, { status: 500 });
  }
}
