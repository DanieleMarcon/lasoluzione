import { NextResponse } from 'next/server';
import { AdminUnauthorizedError, assertAdmin } from '@/lib/admin/session';
import {
  parseContactsFilters,
  resolveContactsPagination,
  fetchContactsData,
  countContacts,
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
  const filters = parseContactsFilters(searchParams);
  const { page, pageSize, offset } = resolveContactsPagination(searchParams);

  const [items, total] = await Promise.all([
    fetchContactsData({
      filters,
      limit: pageSize,
      offset,
    }),
    countContacts(filters),
  ]);

  const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

  return NextResponse.json({
    items,
    page,
    pageSize,
    total,
    totalPages,
  });
}
