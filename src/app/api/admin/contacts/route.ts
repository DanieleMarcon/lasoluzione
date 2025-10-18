import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { AdminUnauthorizedError, assertAdmin } from '@/lib/admin/session';
import {
  CONTACTS_DEFAULT_PAGE_SIZE,
  CONTACTS_MAX_PAGE_SIZE,
  buildContactsWhere,
  parseContactsFilters,
} from '@/lib/admin/contacts-query';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type ContactsApiRow = {
  id: number;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  last_contact_at: Date | string | null;
  privacy_consent: boolean | null;
  newsletter_optin: boolean | null;
  bookings_count: number | null;
};

function normalizeString(value: string | null | undefined) {
  return value?.trim() ?? '';
}

function toIsoString(value: Date | string | null | undefined) {
  if (!value) return new Date(0).toISOString();
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return new Date(0).toISOString();
    return value.toISOString();
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date(0).toISOString();
  return date.toISOString();
}

export async function GET(req: Request) {
  try {
    await assertAdmin();
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw error;
  }

  try {
    const { searchParams } = new URL(req.url);

    const filters = parseContactsFilters(searchParams);

    const rawPageSize = Number(searchParams.get('pageSize') ?? CONTACTS_DEFAULT_PAGE_SIZE);
    const normalizedPageSize =
      Number.isFinite(rawPageSize) && rawPageSize > 0 ? Math.floor(rawPageSize) : CONTACTS_DEFAULT_PAGE_SIZE;
    const pageSize = Math.min(Math.max(normalizedPageSize, 1), CONTACTS_MAX_PAGE_SIZE);

    const rawPage = Number(searchParams.get('page') ?? 1);
    const normalizedPage = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;
    const page = Math.max(normalizedPage, 1);

    const offset = (page - 1) * pageSize;
    const limit = pageSize;

    const where = buildContactsWhere(filters);

    const countSql = Prisma.sql`
      SELECT COUNT(*)::int AS total
      FROM contacts_view AS c
      ${where}
    `;
    const countRows = await prisma.$queryRaw<{ total: number }[]>(countSql);
    const total = countRows?.[0]?.total ?? 0;

    const dataSql = Prisma.sql`
      SELECT
        c.id,
        c.full_name,
        c.email,
        c.phone,
        c.last_contact_at,
        c.privacy_consent,
        c.newsletter_optin,
        c.bookings_count
      FROM contacts_view AS c
      ${where}
      ORDER BY c.last_contact_at DESC, c.id DESC
      LIMIT ${limit} OFFSET ${offset}
    `;
    const rows = await prisma.$queryRaw<ContactsApiRow[]>(dataSql);

    const items = rows.map((row) => ({
      id: row.id,
      name: normalizeString(row.full_name),
      email: normalizeString(row.email),
      phone: normalizeString(row.phone),
      createdAt: toIsoString(row.last_contact_at),
      agreePrivacy: Boolean(row.privacy_consent),
      agreeMarketing: Boolean(row.newsletter_optin),
      totalBookings: Number(row.bookings_count ?? 0),
    }));

    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

    return NextResponse.json({
      ok: true,
      page,
      pageSize: limit,
      total,
      totalPages,
      data: items,
      items,
    });
  } catch (error) {
    console.error('admin/contacts GET error', error);
    return NextResponse.json(
      { ok: false, error: 'CONTACTS_QUERY_FAILED' },
      { status: 500 },
    );
  }
}
