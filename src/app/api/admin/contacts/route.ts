import { NextResponse } from 'next/server';
import { AdminUnauthorizedError, assertAdmin } from '@/lib/admin/session';
import {
  parseDateParam,
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

    const search = searchParams.get('q') || null;
    const newsletter = toYesNoAll(searchParams.get('newsletter'));
    const privacy = toYesNoAll(searchParams.get('privacy'));

    const from = parseDateParam(searchParams.get('from'));
    const to = parseDateParam(searchParams.get('to'));

    const limit = Math.max(
      1,
      Math.min(Number.parseInt(searchParams.get('pageSize') || '20', 10) || 20, 200),
    );
    const page = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
    const offset = (page - 1) * limit;

    const { rows, total } = await queryAdminContacts({
      search,
      newsletter,
      privacy,
      from,
      to,
      limit,
      offset,
    });

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
