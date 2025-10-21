import { randomUUID } from 'node:crypto';
import { performance } from 'node:perf_hooks';

import { assertAdmin } from '@/lib/admin/session';
import {
  parseDateOrNull,
  reconcileContactConsents,
  queryAdminContacts,
  toContactDTO,
  toYesNoAll,
} from '@/lib/admin/contacts-service';
import type { ContactDTO } from '@/types/admin/contacts';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXPORT_MAX_ROWS = 10_000;
const CSV_HEADERS = [
  'name',
  'email',
  'phone',
  'createdAt',
  'privacy',
  'newsletter',
  'totalBookings',
] as const;

const CONTENT_TYPE = 'text/csv';
const CONTENT_DISPOSITION = 'attachment; filename="contacts.csv"';

type CsvHeader = (typeof CSV_HEADERS)[number];
type ContactCsvRow = Record<CsvHeader, unknown>;

function sanitize(value: unknown) {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  let stringValue = String(value).replace(/\r?\n/g, ' ');
  // Excel/Sheets CSV injection guard
  if (/^[=+\-@]/.test(stringValue)) stringValue = `'${stringValue}`;
  stringValue = stringValue.replace(/"/g, '""');
  return /[",]/.test(stringValue) ? `"${stringValue}"` : stringValue;
}

function toRecord(contact: ContactDTO): ContactCsvRow {
  return {
    name: contact.name,
    email: contact.email,
    phone: contact.phone,
    createdAt: contact.createdAt,
    privacy: contact.privacy,
    newsletter: contact.newsletter,
    totalBookings: contact.totalBookings,
  };
}

export async function GET(req: Request) {
  await assertAdmin();

  const { searchParams } = new URL(req.url);
  const query = Object.fromEntries(searchParams.entries());

  const requestId = randomUUID();
  const requestStart = performance.now();
  const isProduction = process.env.NODE_ENV === 'production';

  const log = (entry: Record<string, unknown>) => {
    if (isProduction) return;
    console.log({ requestId, ...entry });
  };

  try {
    const parseStart = performance.now();

    const rawSearch = searchParams.get('q') ?? searchParams.get('search');
    const search = rawSearch && rawSearch.trim().length > 0 ? rawSearch : null;

    const newsletter = toYesNoAll(searchParams.get('newsletter'));
    const privacy = toYesNoAll(searchParams.get('privacy'));

    const from = parseDateOrNull(searchParams.get('from'));
    const to = parseDateOrNull(searchParams.get('to'));

    const pageSize = EXPORT_MAX_ROWS + 1;
    const page = 1;
    const offset = 0;

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
    });

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

    await reconcileContactConsents(rows);

    const mapStart = performance.now();
    const items = rows.map(toContactDTO);
    log({
      stage: 'map',
      durations: { stageMs: performance.now() - mapStart, totalMs: performance.now() - requestStart },
    });

    let truncated = false;
    let data: ContactDTO[] = items;
    if (total > EXPORT_MAX_ROWS) {
      truncated = true;
      data = items.slice(0, EXPORT_MAX_ROWS);
    }

    const csvLines: string[] = [];
    csvLines.push(CSV_HEADERS.join(','));

    for (const contact of data) {
      const record = toRecord(contact);
      const line = CSV_HEADERS.map((header) => sanitize(record[header])).join(',');
      csvLines.push(line);
    }

    if (truncated) csvLines.push('# truncated');

    const headers = new Headers();
    headers.set('Content-Type', CONTENT_TYPE);
    headers.set('Content-Disposition', CONTENT_DISPOSITION);

    log({ stage: 'done', durations: { totalMs: performance.now() - requestStart }, total, exported: data.length, truncated });

    return new Response(csvLines.join('\n'), { status: 200, headers });
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
    console.error('contacts export API error:', {
      route: '/api/admin/contacts/export',
      query,
      cause: err,
    });
    return new Response('INTERNAL_SERVER_ERROR', { status: 500 });
  }
}
