// src/app/api/admin/tiers/[id]/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import type { Prisma, EventTier } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { assertAdmin } from '@/lib/admin/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const updateSchema = z.object({
  label: z.string().trim().min(2).optional(),
  priceCents: z.coerce.number().int().min(0).optional(),
  order: z.coerce.number().int().min(0).optional(),
  active: z.boolean().optional(),
});

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

type RouteContext = { params: { id: string } };

export async function PATCH(request: Request, context: RouteContext) {
  await assertAdmin();

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

  const updates: Prisma.EventTierUpdateInput = {};
  if (payload.label !== undefined) updates.label = payload.label;
  if (payload.priceCents !== undefined) updates.priceCents = payload.priceCents;
  if (payload.order !== undefined) updates.order = payload.order;
  if (payload.active !== undefined) updates.active = payload.active;

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ ok: false, error: 'no_changes' }, { status: 400 });
  }

  const id = context.params.id;
  const existing = await prisma.eventTier.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const updated = await prisma.eventTier.update({ where: { id }, data: updates });
  return NextResponse.json({ ok: true, data: formatTier(updated) });
}

export async function DELETE(request: Request, context: RouteContext) {
  await assertAdmin();

  const id = context.params.id;
  const existing = await prisma.eventTier.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ ok: false, error: 'not_found' }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const hard = searchParams.get('hard') === 'true';

  if (hard) {
    await prisma.eventTier.delete({ where: { id } });
    return NextResponse.json({ ok: true, data: null });
  }

  if (!existing.active) {
    return NextResponse.json({ ok: true, data: formatTier(existing) });
  }

  const updated = await prisma.eventTier.update({ where: { id }, data: { active: false } });
  return NextResponse.json({ ok: true, data: formatTier(updated) });
}
