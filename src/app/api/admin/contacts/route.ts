import { NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/session';
import {
  buildContactsFilters,
  resolveContactsPagination,
  fetchContactsData,
} from '@/lib/admin/contacts-query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  await assertAdmin();

  const { searchParams } = new URL(req.url);
  const filters = buildContactsFilters(searchParams);
  const { page, pageSize, skip } = resolveContactsPagination(searchParams);

  const [data, totalRows] = await Promise.all([
    fetchContactsData({
      whereClause: filters.whereClause,
      params: filters.params,
      limit: pageSize,
      offset: skip,
    }),
    (await import('@/lib/prisma')).prisma.$queryRawUnsafe(
      `SELECT COUNT(DISTINCT LOWER(TRIM(email))) AS total FROM Booking WHERE ${filters.whereClause};`,
      ...(filters.params as any[])
    ) as Promise<Array<{ total: number }>>,
  ]);

  const total = Number(totalRows[0]?.total ?? 0);
  const totalPages = Math.ceil(total / pageSize) || 1;

  return NextResponse.json({
    data,
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
