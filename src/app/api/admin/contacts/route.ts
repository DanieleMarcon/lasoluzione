import { AdminUnauthorizedError, assertAdmin } from '@/lib/admin/session';
import {
  buildContactsFilters,
  fetchContactsData,
  type ContactsFilters,
} from '@/lib/admin/contacts-query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await assertAdmin();
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw error;
  }

  const { searchParams } = new URL(req.url);

  const filters = buildContactsFilters({
    search: searchParams.get('q') ?? searchParams.get('search'),
    newsletter: searchParams.get('newsletter') as ContactsFilters['newsletter'],
    privacy: searchParams.get('privacy') as ContactsFilters['privacy'],
    from: searchParams.get('from'),
    to: searchParams.get('to'),
    page: Number.parseInt(searchParams.get('page') ?? '', 10),
    pageSize: Number.parseInt(searchParams.get('pageSize') ?? '', 10),
  });

  try {
    const { items, total } = await fetchContactsData({ filters });
    return Response.json(
      {
        items,
        page: filters.page,
        pageSize: filters.pageSize,
        total,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error('[admin/contacts] error', err);
    return Response.json(
      {
        items: [],
        page: filters.page,
        pageSize: filters.pageSize,
        total: 0,
        error: 'temporary_failure',
      },
      { status: 200 },
    );
  }
}
