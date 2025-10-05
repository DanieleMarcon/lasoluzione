import { NextResponse } from 'next/server';
import { z } from 'zod';

import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import { ProductUpsertSchema } from '@/types/admin-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const idSchema = z.object({
  id: z
    .string()
    .transform((value) => Number.parseInt(value, 10))
    .pipe(z.number().int().min(1, 'ID non valido')),
});

const updateSchema = ProductUpsertSchema.partial().superRefine((value, ctx) => {
  if (Object.keys(value).length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Nessun campo da aggiornare' });
  }
});

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

export async function PATCH(request: Request, context: { params: { id: string } }) {
  await assertAdmin();

  const parsedId = idSchema.safeParse(context.params);
  if (!parsedId.success) {
    return NextResponse.json({ ok: false, error: parsedId.error.flatten() }, { status: 400 });
  }

  const productId = parsedId.data.id;

  const payload = await request.json().catch(() => null);
  const parsedPayload = updateSchema.safeParse(payload);
  if (!parsedPayload.success) {
    return NextResponse.json({ ok: false, error: parsedPayload.error.flatten() }, { status: 400 });
  }

  const data = parsedPayload.data;

  const existing = await prisma.product.findUnique({ where: { id: productId } });
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const updateData: Parameters<typeof prisma.product.update>[0]['data'] = {};

  if (data.name !== undefined) updateData.name = data.name;
  if (data.description !== undefined) updateData.description = data.description ?? null;
  if (data.ingredients !== undefined) updateData.ingredients = data.ingredients ?? null;
  if (data.allergens !== undefined) updateData.allergens = data.allergens ?? null;
  if (data.priceCents !== undefined) updateData.priceCents = data.priceCents;
  if (data.unitCostCents !== undefined) updateData.unitCostCents = data.unitCostCents;
  if (data.supplierName !== undefined) updateData.supplierName = data.supplierName ?? null;
  if (data.stockQty !== undefined) updateData.stockQty = data.stockQty;
  if (data.imageUrl !== undefined) updateData.imageUrl = data.imageUrl ?? null;
  if (data.category !== undefined) updateData.category = data.category ?? null;
  if (data.order !== undefined) updateData.order = data.order;
  if (data.active !== undefined) updateData.active = data.active;
  if (data.isVegan !== undefined) updateData.isVegan = data.isVegan;
  if (data.isVegetarian !== undefined) updateData.isVegetarian = data.isVegetarian;
  if (data.isGlutenFree !== undefined) updateData.isGlutenFree = data.isGlutenFree;
  if (data.isLactoseFree !== undefined) updateData.isLactoseFree = data.isLactoseFree;
  if (data.isOrganic !== undefined) updateData.isOrganic = data.isOrganic;

  if (data.slug !== undefined || data.name !== undefined) {
    const base = (data.slug ?? '').trim();
    let nextSlug: string | null = null;
    if (base.length > 0) {
      nextSlug = slugify(base);
    } else if (data.name !== undefined) {
      nextSlug = slugify(data.name);
    } else {
      nextSlug = slugify(existing.name);
    }

    if (!nextSlug) {
      return NextResponse.json({ ok: false, error: 'slug_invalid' }, { status: 400 });
    }

    if (nextSlug !== existing.slug) {
      const conflict = await prisma.product.findUnique({ where: { slug: nextSlug } });
      if (conflict && conflict.id !== productId) {
        return NextResponse.json({ ok: false, error: 'slug_conflict' }, { status: 409 });
      }
      updateData.slug = nextSlug;
    }
  }

  try {
    const updated = await prisma.product.update({ where: { id: productId }, data: updateData });
    return NextResponse.json({ ok: true, data: updated });
  } catch (error: any) {
    if (error?.code === 'P2002') {
      return NextResponse.json({ ok: false, error: 'slug_conflict' }, { status: 409 });
    }
    console.error('[PATCH /api/admin/products/[id]] error', error);
    return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: { id: string } }) {
  await assertAdmin();

  const parsedId = idSchema.safeParse(context.params);
  if (!parsedId.success) {
    return NextResponse.json({ ok: false, error: parsedId.error.flatten() }, { status: 400 });
  }

  const productId = parsedId.data.id;
  const { searchParams } = new URL(request.url);
  const hard = searchParams.get('hard') === 'true';

  try {
    if (hard) {
      await prisma.product.delete({ where: { id: productId } });
    } else {
      await prisma.product.update({ where: { id: productId }, data: { active: false } });
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[DELETE /api/admin/products/[id]] error', error);
    return NextResponse.json({ ok: false, error: 'delete_failed' }, { status: 500 });
  }
}
