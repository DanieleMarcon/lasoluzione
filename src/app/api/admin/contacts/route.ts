import { NextResponse } from 'next/server';
import { AdminUnauthorizedError, assertAdmin } from '@/lib/admin/session';
import {
  parseDateOrNull,
  queryAdminContacts,
  toContactDTO,
  toYesNoAll,
} from '@/lib/admin/contacts-service';

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

  let query: Record<string, string> | undefined;

  try {
    const { searchParams } = new URL(req.url);

    query = Object.fromEntries(searchParams.entries());

    const rawSearch = searchParams.get('q');
    const search = rawSearch && rawSearch.trim().length > 0 ? rawSearch : null;

    const newsletter = toYesNoAll(searchParams.get('newsletter'));
    const privacy = toYesNoAll(searchParams.get('privacy'));

    const rawFrom = searchParams.get('from');
    const rawTo = searchParams.get('to');
    const from = parseDateOrNull(rawFrom);
    const to = parseDateOrNull(rawTo);

    const rawPageSize = searchParams.get('pageSize');
    const parsedPageSize = Number.parseInt(rawPageSize ?? '20', 10);
    const limit = Math.max(1, Math.min(Number.isNaN(parsedPageSize) ? 20 : parsedPageSize, 200));

    const rawPage = searchParams.get('page');
    const parsedPage = Number.parseInt(rawPage ?? '1', 10);
    const page = Math.max(1, Number.isNaN(parsedPage) ? 1 : parsedPage);
    const offset = (page - 1) * limit;

    const requestId = req.headers.get('x-request-id') ?? req.headers.get('x-vercel-id');
    const stage = process.env.APP_STAGE ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null;

    const { rows, total } = await queryAdminContacts(
      {
        search,
        newsletter,
        privacy,
        from,
        to,
        limit,
        offset,
      },
      {
        requestId,
        stage,
        fingerprint: 'api/admin/contacts#list',
      },
    );

    return NextResponse.json({
      data: rows.map(toContactDTO),
      total,
      page,
      pageSize: limit,
    });
  } catch (err) {
    console.error('contacts API error:', { route: '/api/admin/contacts', query, cause: err });
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }
}
