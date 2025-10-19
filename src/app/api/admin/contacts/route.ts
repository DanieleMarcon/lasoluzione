import { NextResponse } from 'next/server';
import { AdminUnauthorizedError, assertAdmin } from '@/lib/admin/session';
import {
  buildContactsFilters,
  resolveContactsPagination,
  fetchContactsData,
} from '@/lib/admin/contacts-query';

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

  const { items, total } = await fetchContactsData({
    whereClause: filters.whereClause,
    limit: pageSize,
    offset: skip,
  });

  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

  return NextResponse.json({
    items,
    page,
    pageSize,
    total,
    totalPages,
  });
}
