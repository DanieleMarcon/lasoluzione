import { NextResponse } from 'next/server';

import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';
import { SectionUpsertSchema } from '@/types/admin-catalog';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  await assertAdmin();

  const sections = await prisma.catalogSection.findMany({
    orderBy: { displayOrder: 'asc' },
  });

  return NextResponse.json({ ok: true, data: sections });
}

export async function POST(request: Request) {
  await assertAdmin();

  const payload = await request.json().catch(() => null);
  const parsed = SectionUpsertSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: parsed.error.flatten() }, { status: 400 });
  }

  const data = parsed.data;

  try {
    const upserted = await prisma.catalogSection.upsert({
      where: { key: data.key },
      update: {
        title: data.title,
        description: data.description ?? null,
        enableDateTime: data.enableDateTime ?? undefined,
        active: data.active ?? undefined,
        displayOrder: data.displayOrder ?? undefined,
      },
      create: {
        key: data.key,
        title: data.title,
        description: data.description ?? null,
        enableDateTime: data.enableDateTime ?? false,
        active: data.active ?? true,
        displayOrder: data.displayOrder ?? 0,
      },
    });

    return NextResponse.json({ ok: true, data: upserted });
  } catch (error) {
    console.error('[POST /api/admin/sections] error', error);
    return NextResponse.json({ ok: false, error: 'upsert_failed' }, { status: 500 });
  }
}
