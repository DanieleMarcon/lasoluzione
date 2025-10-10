// src/app/api/admin/events/tiers/[tierId]/route.ts
import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';
import { z } from 'zod';

import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({
  tierId: z.string(),
});

const updateSchema = z
  .object({
    eventId: z.coerce.number().int().positive(),
    label: z.string().trim().min(2).optional(),
    description: z.string().trim().max(2000).optional().nullable(),
    priceCents: z.coerce.number().int().min(0).optional(),
    order: z.coerce.number().int().optional(),
    active: z.boolean().optional(),
  })
  .refine((value) => {
    const { eventId, ...rest } = value;
    return Object.values(rest).some((v) => v !== undefined);
  }, { message: 'no_fields' });

const deleteSchema = z.object({
  eventId: z.coerce.number().int().positive(),
});

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

async function ensureTier(tierId: number, eventId: number) {
  const product = await prisma.product.findUnique({ where: { id: tierId } });
  if (!product) return null;
  if (product.sourceType !== 'event_instance_tier' || product.sourceId !== String(eventId)) {
    return null;
  }
  return product;
}

export async function PATCH(request: Request, context: { params: { tierId: string } }) {
  await assertAdmin();

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }

  const tierId = Number.parseInt(parsedParams.data.tierId, 10);
  if (!Number.isInteger(tierId) || tierId <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }

  let payload: z.infer<typeof updateSchema>;
  try {
    payload = updateSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'validation_error', details: error.flatten() },
        { status: 400 },
      );
    }
    throw error;
  }

  const existing = await ensureTier(tierId, payload.eventId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const updates: Prisma.ProductUpdateInput = {};
  if (payload.label !== undefined) updates.name = payload.label;
  if (payload.description !== undefined) {
    const trimmedDescription =
      payload.description == null ? null : payload.description.trim() || null;
    updates.description = trimmedDescription;
  }
  if (payload.priceCents !== undefined) updates.priceCents = payload.priceCents;
  if (payload.order !== undefined) updates.order = payload.order;
  if (payload.active !== undefined) updates.active = payload.active;

  try {
    const updated = await prisma.product.update({ where: { id: tierId }, data: updates });
    return NextResponse.json({ ok: true, data: formatTier(updated) });
  } catch (error) {
    console.error('[admin][events][tiers][PATCH]', error);
    return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: { tierId: string } }) {
  await assertAdmin();

  const parsedParams = paramsSchema.safeParse(context.params);
  if (!parsedParams.success) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }

  const tierId = Number.parseInt(parsedParams.data.tierId, 10);
  if (!Number.isInteger(tierId) || tierId <= 0) {
    return NextResponse.json({ ok: false, error: 'invalid_id' }, { status: 400 });
  }

  let payload: z.infer<typeof deleteSchema>;
  try {
    payload = deleteSchema.parse(await request.json());
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { ok: false, error: 'validation_error', details: error.flatten() },
        { status: 400 },
      );
    }
    throw error;
  }

  const existing = await ensureTier(tierId, payload.eventId);
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  try {
    await prisma.sectionProduct.deleteMany({ where: { productId: tierId } });
    await prisma.product.delete({ where: { id: tierId } });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('[admin][events][tiers][DELETE]', error);
    return NextResponse.json({ ok: false, error: 'delete_failed' }, { status: 500 });
  }
}
