import { NextResponse } from 'next/server';

import { assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  await assertAdmin();

  const { searchParams } = new URL(req.url);
  const q = (searchParams.get('q') || '').trim();
  const take = Number.parseInt(searchParams.get('take') || '', 10);
  const limit = Number.isFinite(take) && take > 0 ? Math.min(take, 50) : 10;

  if (!q) {
    return NextResponse.json({ items: [] });
  }

  const items = await prisma.eventItem.findMany({
    where: {
      active: true,
      OR: [
        { title: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
      ],
    },
    orderBy: { startAt: 'asc' },
    take: limit,
    select: {
      id: true,
      title: true,
      slug: true,
      priceCents: true,
      startAt: true,
    },
  });

  return NextResponse.json({
    items: items.map((item) => ({
      id: item.id,
      title: item.title,
      slug: item.slug,
      priceCents: item.priceCents,
      startAt: item.startAt.toISOString(),
    })),
  });
}
