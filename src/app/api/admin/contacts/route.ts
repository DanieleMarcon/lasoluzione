import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { AdminUnauthorizedError, assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type DbRow = {
  name: string | null;
  email: string | null;
  phone: string | null;
  last_contact_at: Date | string | null;
  privacy: boolean | null;
  newsletter: boolean | null;
  total_bookings: number | bigint | null;
};

type ApiRow = {
  name: string | null;
  email: string | null;
  phone: string | null;
  lastContactAt: string | null;
  privacy: boolean;
  newsletter: boolean;
  totalBookings: number;
};

function parseDateParam(v: string | null): Date | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function normalizeFlagParam(value: string | null): 'all' | 'yes' | 'no' {
  if (value === 'yes' || value === 'no') {
    return value;
  }
  return 'all';
}

export async function GET(req: Request) {
  try {
    await assertAdmin();
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw error;
  }

  try {
    const { searchParams } = new URL(req.url);

    const search = searchParams.get('q') || null;
    const newsletter = normalizeFlagParam(searchParams.get('newsletter'));
    const privacy = normalizeFlagParam(searchParams.get('privacy'));

    const from = parseDateParam(searchParams.get('from'));
    const to = parseDateParam(searchParams.get('to'));

    const limit = Math.max(
      1,
      Math.min(Number.parseInt(searchParams.get('pageSize') || '20', 10) || 20, 200),
    );
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
    const offset = (page - 1) * limit;

    const rows = await prisma.$queryRaw<DbRow[]>(
      Prisma.sql`select * from public.admin_contacts_search(
        ${search}, ${newsletter}, ${privacy}, ${from}, ${to}, ${limit}, ${offset}
      )`,
    );

    let total = 0;
    try {
      const totalRes = await prisma.$queryRaw<{ count: bigint }[]>(
        Prisma.sql`select count(*)::bigint as count
                   from public.admin_contacts_search(
                     ${search}, ${newsletter}, ${privacy}, ${from}, ${to}, ${Prisma.sql`NULL`}, ${Prisma.sql`NULL`}
                   )`,
      );
      total = Number(totalRes?.[0]?.count ?? 0);
    } catch {
      const totalRes = await prisma.$queryRaw<{ count: bigint }[]>(
        Prisma.sql`select count(*)::bigint as count
                   from (
                     select * from public.admin_contacts_search(
                       ${search}, ${newsletter}, ${privacy}, ${from}, ${to}, 1000000000, 0
                     )
                   ) t`,
      );
      total = Number(totalRes?.[0]?.count ?? 0);
    }

    const data: ApiRow[] = rows.map((r) => ({
      name: r.name ?? null,
      email: r.email ?? null,
      phone: r.phone ?? null,
      lastContactAt: r.last_contact_at ? new Date(r.last_contact_at).toISOString() : null,
      privacy: Boolean(r.privacy),
      newsletter: Boolean(r.newsletter),
      totalBookings: Number(r.total_bookings ?? 0),
    }));

    return NextResponse.json({ data, total, page, pageSize: limit });
  } catch (err) {
    console.error('contacts API error:', err);
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }
}
