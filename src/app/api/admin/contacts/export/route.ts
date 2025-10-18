import { assertAdmin } from '@/lib/admin/session';
import {
  buildContactsFilters,
  fetchContactsData,
  type ContactDTO,
} from '@/lib/admin/contacts-query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXPORT_MAX_ROWS = 10_000;
const CSV_HEADERS = [
  'name',
  'email',
  'phone',
  'createdAt',
  'agreePrivacy',
  'agreeMarketing',
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
    agreePrivacy: contact.agreePrivacy,
    agreeMarketing: contact.agreeMarketing,
    totalBookings: contact.totalBookings,
  };
}

export async function GET(req: Request) {
  await assertAdmin();

  const { searchParams } = new URL(req.url);
  const filters = buildContactsFilters(searchParams);

  const rows = await fetchContactsData({
    whereClause: filters.whereClause,
    params: filters.params,
    limit: EXPORT_MAX_ROWS + 1,
    offset: 0,
  });

  let truncated = false;
  let data: ContactDTO[] = rows;
  if (rows.length > EXPORT_MAX_ROWS) {
    truncated = true;
    data = rows.slice(0, EXPORT_MAX_ROWS);
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
