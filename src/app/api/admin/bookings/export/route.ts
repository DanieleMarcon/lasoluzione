import { prisma } from '@/lib/prisma';
import { assertAdmin } from '@/lib/admin/session';
import { buildAdminBookingQuery } from '@/lib/admin/booking-query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EXPORT_MAX_ROWS = 10_000;
const CSV_HEADERS = [
  'id',
  'date',
  'type',
  'status',
  'people',
  'name',
  'email',
  'phone',
  'notes',
  'agreePrivacy',
  'agreeMarketing',
  'createdAt',
] as const;

type CsvHeader = (typeof CSV_HEADERS)[number];

type BookingExportRow = Record<CsvHeader, unknown>;

const sanitize = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  let stringValue = String(value).replace(/\r?\n/g, ' ');
  if (/^[=+\-@]/.test(stringValue)) {
    stringValue = `'${stringValue}`;
  }
  stringValue = stringValue.replace(/"/g, '""');
  return /[",]/.test(stringValue) ? `"${stringValue}"` : stringValue;
};

export async function GET(req: Request) {
  await assertAdmin();

  const url = new URL(req.url);
  const originalParams = url.searchParams;
  const searchParams = new URLSearchParams(originalParams);

  const search = searchParams.get('search');
  if (search && !searchParams.get('q')) {
    searchParams.set('q', search);
  }

  const { where } = buildAdminBookingQuery(searchParams);
  const orderBy = { date: 'desc' as const };

  const bookings = await prisma.booking.findMany({
    where,
    orderBy,
    take: EXPORT_MAX_ROWS + 1,
    select: {
      id: true,
      date: true,
      type: true,
      status: true,
      people: true,
      name: true,
      email: true,
      phone: true,
      notes: true,
      agreePrivacy: true,
      agreeMarketing: true,
      createdAt: true,
    },
  });

  let truncated = false;
  let rows = bookings;
  if (bookings.length > EXPORT_MAX_ROWS) {
    truncated = true;
    rows = bookings.slice(0, EXPORT_MAX_ROWS);
  }

  const csvRows: string[] = [];
  csvRows.push(CSV_HEADERS.join(','));

  for (const booking of rows) {
    const record: BookingExportRow = {
      id: booking.id,
      date: booking.date,
      type: booking.type,
      status: booking.status,
      people: booking.people,
      name: booking.name,
      email: booking.email,
      phone: booking.phone,
      notes: booking.notes,
      agreePrivacy: booking.agreePrivacy,
      agreeMarketing: booking.agreeMarketing,
      createdAt: booking.createdAt,
    };

    const line = CSV_HEADERS.map((header) => sanitize(record[header])).join(',');
    csvRows.push(line);
  }

  if (truncated) {
    csvRows.push('# truncated');
  }

  const csv = csvRows.join('\n');

  const headers = new Headers();
  headers.set('Content-Type', 'text/csv');
  headers.set('Content-Disposition', 'attachment; filename="bookings.csv"');

  return new Response(csv, { status: 200, headers });
}
