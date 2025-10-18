import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { AdminUnauthorizedError, assertAdmin } from '@/lib/admin/session';
import { prisma } from '@/lib/prisma';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 200;

type ContactRow = {
  name: string | null;
  email: string | null;
  phone: string | null;
  privacy: boolean | null;
  newsletter: boolean | null;
  last_contact_at: Date | string;
  bookings: bigint | number | null;
};

function parsePage(value: string | null): number {
  const parsed = Number.parseInt(value ?? '1', 10);
  if (Number.isNaN(parsed) || parsed < 1) return 1;
  return parsed;
}

function parsePageSize(value: string | null): number {
  const parsed = Number.parseInt(value ?? String(DEFAULT_PAGE_SIZE), 10);
  if (Number.isNaN(parsed) || parsed < 1) return DEFAULT_PAGE_SIZE;
  return Math.min(parsed, MAX_PAGE_SIZE);
}

function parseBoolean(value: string | null): boolean | null {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function parseDateStart(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(0, 0, 0, 0);
  return parsed.toISOString();
}

function parseDateEnd(value: string | null): string | null {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  parsed.setHours(23, 59, 59, 999);
  return parsed.toISOString();
}

function toIsoString(value: Date | string | null): string {
  if (!value) return new Date(0).toISOString();
  if (value instanceof Date) return value.toISOString();
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return new Date(0).toISOString();
  return parsed.toISOString();
}

function buildWhereClause(parts: Prisma.Sql[]): Prisma.Sql {
  if (parts.length === 0) {
    return Prisma.sql``;
  }

  const combined = parts.slice(1).reduce<Prisma.Sql>((acc, part) => Prisma.sql`${acc} AND ${part}`, parts[0]);
  return Prisma.sql`WHERE ${combined}`;
}

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

  try {
    const { searchParams } = new URL(req.url);

    const page = parsePage(searchParams.get('page'));
    const pageSize = parsePageSize(searchParams.get('pageSize'));
    const offset = (page - 1) * pageSize;

    const search = (searchParams.get('q') ?? searchParams.get('search') ?? '').trim().toLowerCase();
    const newsletterFilter = parseBoolean(searchParams.get('newsletter'));
    const privacyFilter = parseBoolean(searchParams.get('privacy'));
    const from = parseDateStart(searchParams.get('from'));
    const to = parseDateEnd(searchParams.get('to'));

    const baseConditions: Prisma.Sql[] = [];
    if (search) {
      const wildcard = `%${search}%`;
      baseConditions.push(
        Prisma.sql`(LOWER(TRIM(b."name")) LIKE ${wildcard} OR LOWER(TRIM(b."email")) LIKE ${wildcard} OR LOWER(TRIM(b."phone")) LIKE ${wildcard})`,
      );
    }
    if (from) {
      baseConditions.push(Prisma.sql`b."createdAt" >= ${from}`);
    }
    if (to) {
      baseConditions.push(Prisma.sql`b."createdAt" <= ${to}`);
    }

    const baseWhere = buildWhereClause(baseConditions);

    const aggregatedConditions: Prisma.Sql[] = [];
    if (newsletterFilter !== null) {
      aggregatedConditions.push(Prisma.sql`newsletter = ${newsletterFilter}`);
    }
    if (privacyFilter !== null) {
      aggregatedConditions.push(Prisma.sql`privacy = ${privacyFilter}`);
    }

    const aggregatedWhere = buildWhereClause(aggregatedConditions);

    const rows = await prisma.$queryRaw<ContactRow[]>(Prisma.sql`
      WITH base AS (
        SELECT
          MAX(TRIM(b."name")) AS name,
          TRIM(b."email") AS email,
          TRIM(b."phone") AS phone,
          MAX(b."createdAt") AS last_contact_at,
          BOOL_OR(b."agreePrivacy") AS privacy,
          BOOL_OR(b."agreeMarketing") AS newsletter,
          COUNT(*) AS bookings
        FROM "Booking" b
        ${baseWhere}
        GROUP BY 2, 3
      )
      SELECT
        name,
        email,
        phone,
        privacy,
        newsletter,
        last_contact_at,
        bookings
      FROM base
      ${aggregatedWhere}
      ORDER BY last_contact_at DESC
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    const [{ total } = { total: 0 }] = await prisma.$queryRaw<Array<{ total: number }>>(Prisma.sql`
      WITH base AS (
        SELECT
          TRIM(b."email") AS email,
          TRIM(b."phone") AS phone,
          BOOL_OR(b."agreePrivacy") AS privacy,
          BOOL_OR(b."agreeMarketing") AS newsletter
        FROM "Booking" b
        ${baseWhere}
        GROUP BY 1, 2
      )
      SELECT COUNT(*)::int AS total
      FROM base
      ${aggregatedWhere}
    `);

    const data = rows.map((row) => ({
      name: row.name?.trim() ?? '',
      email: row.email?.trim() ?? '',
      phone: row.phone?.trim() ?? '',
      createdAt: toIsoString(row.last_contact_at),
      agreePrivacy: Boolean(row.privacy),
      agreeMarketing: Boolean(row.newsletter),
      totalBookings: Number(row.bookings ?? 0),
    }));

    const safeTotal = Number.isFinite(total) ? Number(total) : 0;
    const hasPrevPage = page > 1 && safeTotal > 0;
    const hasNextPage = offset + data.length < safeTotal;

    return NextResponse.json({
      data,
      page,
      pageSize,
      total: safeTotal,
      hasNextPage,
      hasPrevPage,
    });
  } catch (error) {
    console.error('Failed to query admin contacts', error);
    const detail = error instanceof Error ? error.message : undefined;
    return NextResponse.json(
      {
        error: 'ContactsQueryFailed',
        ...(detail ? { detail } : {}),
      },
      { status: 500 },
    );
  }
}
