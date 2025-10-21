import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

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
  const requestId = randomUUID();
  const requestStart = performance.now();
  const isProduction = process.env.NODE_ENV === 'production';

  const log = (entry: Record<string, unknown>) => {
    if (isProduction) return;
    const payload = { requestId, ...entry };
    console.log(payload);
  };

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

    const parseStart = performance.now();

    const rawSearch = searchParams.get('q');
    const search = rawSearch && rawSearch.trim().length > 0 ? rawSearch : null;

    const newsletter = toYesNoAll(searchParams.get('newsletter'));
    const privacy = toYesNoAll(searchParams.get('privacy'));

    const from = parseDateOrNull(searchParams.get('from'));
    const to = parseDateOrNull(searchParams.get('to'));

    const rawPageSize = searchParams.get('pageSize');
    const parsedPageSize = Number.parseInt(rawPageSize ?? '20', 10);
    const initialPageSize = Number.isNaN(parsedPageSize) ? 20 : parsedPageSize;

    const rawPage = searchParams.get('page');
    const parsedPage = Number.parseInt(rawPage ?? '1', 10);
    const initialPage = Number.isNaN(parsedPage) ? 1 : parsedPage;

    const issues: string[] = [];
    if (initialPage < 1) issues.push('page<1');
    if (initialPageSize < 1 || initialPageSize > 200) issues.push('pageSize_out_of_range');

    const pageSize = Math.min(Math.max(initialPageSize, 1), 200);
    const page = initialPage < 1 ? 1 : initialPage;
    const offset = (page - 1) * pageSize;

    log({
      stage: 'parse',
      queryNormalized: {
        search,
        newsletter,
        privacy,
        from: from ? from.toISOString() : null,
        to: to ? to.toISOString() : null,
        page,
        pageSize,
        offset,
      },
      durations: { stageMs: performance.now() - parseStart, totalMs: performance.now() - requestStart },
      issues: issues.length ? issues : undefined,
    });

    if (!isProduction && issues.length > 0) {
      log({
        stage: 'done',
        error: true,
        reason: 'INVALID_PAGINATION',
        durations: { totalMs: performance.now() - requestStart },
      });
      return NextResponse.json({ error: 'INVALID_PAGINATION' }, { status: 400 });
    }

    const { rows, total } = await queryAdminContacts(
      {
        search,
        newsletter,
        privacy,
        from,
        to,
        limit: pageSize,
        offset,
      },
      {
        logger: (entry) =>
          log({
            stage: entry.stage,
            sqlArgs: entry.sqlArgs,
            durations: entry.durations,
            error: entry.error,
            fingerprint: entry.fingerprint,
          }),
      },
    );

    const mapStart = performance.now();
    const data = rows.map(toContactDTO);
    log({
      stage: 'map',
      durations: { stageMs: performance.now() - mapStart, totalMs: performance.now() - requestStart },
    });

    const payload = {
      data,
      total,
      page,
      pageSize,
    };

    log({ stage: 'done', durations: { totalMs: performance.now() - requestStart }, total });

    return NextResponse.json(payload);
  } catch (err) {
    log({
      stage: 'done',
      error: true,
      fingerprint:
        err && typeof err === 'object'
          ? {
              name: (err as any).name,
              code: (err as any).code,
              message: typeof (err as any).message === 'string' ? (err as any).message.split('\n')[0] : undefined,
            }
          : { name: typeof err, message: String(err) },
      durations: { totalMs: performance.now() - requestStart },
    });
    console.error('contacts API error:', { route: '/api/admin/contacts', query, cause: err });
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }
}
