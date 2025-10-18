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

  try {
    const [data, totalRows] = await Promise.all([
      fetchContactsData({
        where: filters.where,
        limit: pageSize,
        offset: skip,
      }),
      prisma.$queryRaw<{ total: number }[]>(Prisma.sql`
        WITH normalized AS (
          SELECT
            LOWER(TRIM(COALESCE(b."email", ''))) AS "normalizedEmail"
          FROM "Booking" b
          ${filters.where}
          GROUP BY 1
        )
        SELECT COUNT(*)::int AS "total" FROM normalized
      `),
    ]);

    const total = Number(totalRows[0]?.total ?? 0);
    const hasPrevPage = total > 0 && page > 1;
    const hasNextPage = skip + data.length < total;

    return NextResponse.json({
      data,
      page,
      pageSize,
      total,
      hasNextPage,
      hasPrevPage,
    });
  } catch (error) {
    console.error('Contacts query failed', error);
    const detail = error instanceof Error ? error.message : undefined;
    return NextResponse.json(
      { error: 'ContactsQueryFailed', detail },
      { status: 500 },
    );
  }
}
