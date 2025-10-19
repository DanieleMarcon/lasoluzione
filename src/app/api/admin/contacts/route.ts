import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { AdminUnauthorizedError, assertAdmin } from '@/lib/admin/session';
import {
  buildContactsFilters,
  resolveContactsPagination,
  fetchContactsData,
} from '@/lib/admin/contacts-query';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await assertAdmin();
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw error;
  }

  const { searchParams } = new URL(req.url);
  const filters = buildContactsFilters(searchParams);
  const { page, pageSize, skip } = resolveContactsPagination(searchParams);

  const [items, totalRows] = await Promise.all([
    fetchContactsData({
      whereClause: filters.whereClause,
      limit: pageSize,
      offset: skip,
    }),
    prisma.$queryRaw<Array<{ total: number }>>(
      Prisma.sql`
        SELECT COUNT(*)::int AS total
        FROM admin_contacts_view
        ${filters.whereClause}
      `,
    ),
  ]);

  const total = Number(totalRows[0]?.total ?? 0);
  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

  return NextResponse.json({
    items,
    page,
    pageSize,
    total,
    totalPages,
  });
}
