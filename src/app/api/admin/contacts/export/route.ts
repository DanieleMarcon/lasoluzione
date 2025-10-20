import { assertAdmin } from '@/lib/admin/session';
import {
  parseDateParam,
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
  const search = searchParams.get('q') ?? searchParams.get('search') ?? null;
  const newsletter = toYesNoAll(searchParams.get('newsletter'));
  const privacy = toYesNoAll(searchParams.get('privacy'));
  const from = parseDateParam(searchParams.get('from'));
  const to = parseDateParam(searchParams.get('to'));

  const { rows, total } = await queryAdminContacts({
    search,
    newsletter,
    privacy,
    from,
    to,
    limit: EXPORT_MAX_ROWS + 1,
    offset: 0,
  });

  const items = rows.map(toContactDTO);

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

  return new Response(csvLines.join('\n'), { status: 200, headers });
}
