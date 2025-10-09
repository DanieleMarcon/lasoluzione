import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { assertAdmin } from '@/lib/admin/session';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const CONTACTS_DEFAULT_PAGE_SIZE = 20;
export const CONTACTS_MAX_PAGE_SIZE = 100;

export type ContactFilters = {
  whereClause: string;
  params: unknown[];
};

export type AdminContact = {
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  agreePrivacy: boolean;
  agreeMarketing: boolean;
  totalBookings: number;
};

type ContactQueryRow = {
  name: string | null;
  email: string | null;
  phone: string | null;
  agreePrivacy: number | boolean | null;
  agreeMarketing: number | boolean | null;
  createdAt: string | Date;
  totalBookings: number;
};

type PaginationOptions = {
  defaultPageSize?: number;
  maxPageSize?: number;
};

type PaginationResult = {
  page: number;
  pageSize: number;
  skip: number;
};

function parseBooleanFilter(value: string | null): boolean | null {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return null;
}

function parseDateStart(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function parseDateEnd(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(23, 59, 59, 999);
  return date.toISOString();
}

export function buildContactsFilters(searchParams: URLSearchParams): ContactFilters {
  const conditions: string[] = [];
  const params: unknown[] = [];

  const search = (searchParams.get('search') ?? searchParams.get('q') ?? '').trim();
  if (search) {
    const wildcard = `%${search.toLowerCase()}%`;
    conditions.push('(LOWER(name) LIKE ? OR LOWER(email) LIKE ? OR LOWER(phone) LIKE ?)');
    params.push(wildcard, wildcard, wildcard);
  }

  const newsletter = parseBooleanFilter(searchParams.get('newsletter'));
  if (newsletter !== null) {
    conditions.push('agreeMarketing = ?');
    params.push(newsletter ? 1 : 0);
  }

  const privacy = parseBooleanFilter(searchParams.get('privacy'));
  if (privacy !== null) {
    conditions.push('agreePrivacy = ?');
    params.push(privacy ? 1 : 0);
  }

  const from = parseDateStart(searchParams.get('from'));
  if (from) {
    conditions.push('createdAt >= ?');
    params.push(from);
  }

  const to = parseDateEnd(searchParams.get('to'));
  if (to) {
    conditions.push('createdAt <= ?');
    params.push(to);
  }

  const whereClause = conditions.length > 0 ? conditions.join(' AND ') : '1=1';

  return { whereClause, params };
}

export function resolveContactsPagination(
  searchParams: URLSearchParams,
  options: PaginationOptions = {}
): PaginationResult {
  const defaultPageSize = options.defaultPageSize ?? CONTACTS_DEFAULT_PAGE_SIZE;
  const maxPageSize = options.maxPageSize ?? CONTACTS_MAX_PAGE_SIZE;

  const pageRaw = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const page = Number.isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;

  const sizeRaw = Number.parseInt(searchParams.get('pageSize') ?? String(defaultPageSize), 10);
  const normalizedSize = Number.isNaN(sizeRaw) || sizeRaw < 1 ? defaultPageSize : sizeRaw;
  const pageSize = Math.min(normalizedSize, maxPageSize);

  const skip = (page - 1) * pageSize;

  return { page, pageSize, skip };
}

function toIsoString(value: string | Date) {
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function mapContactRow(row: ContactQueryRow): AdminContact {
  return {
    name: row.name?.trim() ?? '',
    email: row.email?.trim() ?? '',
    phone: row.phone?.trim() ?? '',
    createdAt: toIsoString(row.createdAt),
    agreePrivacy: Boolean(row.agreePrivacy),
    agreeMarketing: Boolean(row.agreeMarketing),
    totalBookings: Number(row.totalBookings ?? 0),
  };
}

export async function fetchContactsData({
  whereClause,
  params,
  limit,
  offset = 0,
}: {
  whereClause: string;
  params: unknown[];
  limit?: number;
  offset?: number;
}): Promise<AdminContact[]> {
  const paginationClause = typeof limit === 'number' ? ' LIMIT ? OFFSET ?' : '';
  const queryParams = [...params];
  if (typeof limit === 'number') {
    queryParams.push(limit, offset);
  }

  const query = `
    WITH filtered AS (
      SELECT
        id,
        name,
        TRIM(email) AS email,
        LOWER(TRIM(email)) AS normalizedEmail,
        phone,
        agreePrivacy,
        agreeMarketing,
        createdAt
      FROM Booking
      WHERE ${whereClause}
    ),
    ranked AS (
      SELECT
        id,
        name,
        email,
        phone,
        agreePrivacy,
        agreeMarketing,
        createdAt,
        normalizedEmail,
        ROW_NUMBER() OVER (PARTITION BY normalizedEmail ORDER BY createdAt DESC, id DESC) AS rowNumber,
        COUNT(*) OVER (PARTITION BY normalizedEmail) AS totalBookings
      FROM filtered
    )
    SELECT
      name,
      email,
      phone,
      agreePrivacy,
      agreeMarketing,
      createdAt,
      totalBookings
    FROM ranked
    WHERE rowNumber = 1
    ORDER BY createdAt DESC${paginationClause};
  `;

  const rows = await prisma.$queryRawUnsafe<ContactQueryRow[]>(query, ...queryParams);
  return rows.map(mapContactRow);
}

export async function GET(req: Request) {
  await assertAdmin();

  const { searchParams } = new URL(req.url);
  const filters = buildContactsFilters(searchParams);
  const { page, pageSize, skip } = resolveContactsPagination(searchParams);

  const [data, totalResult] = await Promise.all([
    fetchContactsData({ whereClause: filters.whereClause, params: filters.params, limit: pageSize, offset: skip }),
    prisma.$queryRawUnsafe<Array<{ total: number }>>(
      `SELECT COUNT(DISTINCT LOWER(TRIM(email))) AS total FROM Booking WHERE ${filters.whereClause};`,
      ...filters.params
    ),
  ]);

  const total = Number(totalResult[0]?.total ?? 0);
  const totalPages = Math.ceil(total / pageSize) || 1;

  return NextResponse.json({
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  });
}
