// src/lib/admin/contacts-query.ts
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export const CONTACTS_DEFAULT_PAGE_SIZE = 20;
export const CONTACTS_MAX_PAGE_SIZE = 100;

export type ContactFilterParams = {
  search?: string;
  newsletter: 'all' | 'true' | 'false';
  privacy: 'all' | 'true' | 'false';
  from?: Date;
  to?: Date;
};

export type ContactDTO = {
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  agreePrivacy: boolean;
  agreeMarketing: boolean;
  totalBookings: number;
};

type ContactQueryRow = {
  id: number | string;
  name: string | null;
  email: string | null;
  phone: string | null;
  agreePrivacy: boolean | number | null;
  agreeMarketing: boolean | number | null;
  createdAt: string | Date;
  totalBookings: number;
};

export type PaginationOptions = {
  defaultPageSize?: number;
  maxPageSize?: number;
};

export type PaginationResult = {
  page: number;
  pageSize: number;
  offset: number;
};

function parseBooleanChoice(value: string | null): 'all' | 'true' | 'false' {
  if (value === 'true') return 'true';
  if (value === 'false') return 'false';
  return 'all';
}

function parseDateStart(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseDateEndExclusive(value: string | null): Date | null {
  const start = parseDateStart(value);
  if (!start) return null;
  const exclusive = new Date(start);
  exclusive.setDate(exclusive.getDate() + 1);
  return exclusive;
}

export function parseContactsFilters(searchParams: URLSearchParams): ContactFilterParams {
  const rawSearch = (searchParams.get('q') ?? searchParams.get('search') ?? '').trim();
  const filters: ContactFilterParams = {
    search: rawSearch ? rawSearch : undefined,
    newsletter: parseBooleanChoice(searchParams.get('newsletter')),
    privacy: parseBooleanChoice(searchParams.get('privacy')),
  };

  const from = parseDateStart(searchParams.get('from'));
  if (from) filters.from = from;

  const to = parseDateEndExclusive(searchParams.get('to'));
  if (to) filters.to = to;

  return filters;
}

function buildContactConditions(filters: ContactFilterParams): Prisma.Sql[] {
  const conditions: Prisma.Sql[] = [];
  const { search, newsletter, privacy, from, to } = filters;

  if (search && search.trim()) {
    const wildcard = `%${search.trim().toLowerCase()}%`;
    conditions.push(
      Prisma.sql`(LOWER(b.name) LIKE ${wildcard} OR LOWER(b.email) LIKE ${wildcard} OR b.phone LIKE ${wildcard})`,
    );
  }

  if (newsletter === 'true') conditions.push(Prisma.sql`b.agreeMarketing = true`);
  if (newsletter === 'false') conditions.push(Prisma.sql`b.agreeMarketing = false`);

  if (privacy === 'true') conditions.push(Prisma.sql`b.agreePrivacy = true`);
  if (privacy === 'false') conditions.push(Prisma.sql`b.agreePrivacy = false`);

  if (from) conditions.push(Prisma.sql`b.createdAt >= ${from}`);
  if (to) conditions.push(Prisma.sql`b.createdAt < ${to}`);

  return conditions;
}

export function resolveContactsWhere(filters: ContactFilterParams): Prisma.Sql {
  const conditions = buildContactConditions(filters);
  if (conditions.length === 0) return Prisma.sql``;
  return Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`;
}

export function resolveContactsPagination(
  searchParams: URLSearchParams,
  options: PaginationOptions = {},
): PaginationResult {
  const defaultPageSize = options.defaultPageSize ?? CONTACTS_DEFAULT_PAGE_SIZE;
  const maxPageSize = options.maxPageSize ?? CONTACTS_MAX_PAGE_SIZE;

  const pageRaw = Number.parseInt(searchParams.get('page') ?? '1', 10);
  const page = Number.isNaN(pageRaw) || pageRaw < 1 ? 1 : pageRaw;

  const sizeRaw = Number.parseInt(searchParams.get('pageSize') ?? String(defaultPageSize), 10);
  const normalizedSize = Number.isNaN(sizeRaw) || sizeRaw < 1 ? defaultPageSize : sizeRaw;
  const pageSize = Math.min(normalizedSize, maxPageSize);

  const offset = (page - 1) * pageSize;
  return { page, pageSize, offset };
}

export function resolveContactsPaginationClause(page: number, pageSize: number): Prisma.Sql {
  const safeSize = Math.min(Math.max(pageSize || CONTACTS_DEFAULT_PAGE_SIZE, 1), CONTACTS_MAX_PAGE_SIZE);
  const safePage = Math.max(page || 1, 1);
  const offset = (safePage - 1) * safeSize;
  return Prisma.sql`LIMIT ${safeSize} OFFSET ${offset}`;
}

function toIsoString(value: string | Date) {
  if (value instanceof Date) return value.toISOString();
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function mapContactRow(row: ContactQueryRow): ContactDTO {
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
  filters,
  limit,
  offset = 0,
  maxLimit = CONTACTS_MAX_PAGE_SIZE,
}: {
  filters: ContactFilterParams;
  limit?: number;
  offset?: number;
  maxLimit?: number;
}): Promise<ContactDTO[]> {
  const whereClause = resolveContactsWhere(filters);
  const shouldPaginate = typeof limit === 'number' && Number.isFinite(limit);
  const upperBound = Math.max(1, Math.trunc(maxLimit));
  const safeLimit = shouldPaginate ? Math.max(1, Math.min(Math.trunc(limit as number), upperBound)) : null;
  const safeOffset = Number.isFinite(offset) ? Math.max(0, Math.trunc(offset)) : 0;

  const paginationClause = safeLimit
    ? Prisma.sql`LIMIT ${safeLimit} OFFSET ${safeOffset}`
    : Prisma.sql``;

  const rows = await prisma.$queryRaw<ContactQueryRow[]>(Prisma.sql`
    WITH filtered AS (
      SELECT
        b.id,
        b.name,
        TRIM(b.email) AS email,
        LOWER(TRIM(b.email)) AS normalized_email,
        b.phone,
        b.agreePrivacy,
        b.agreeMarketing,
        b.createdAt
      FROM "Booking" AS b
      ${whereClause}
    ),
    ranked AS (
      SELECT
        f.id,
        f.name,
        f.email,
        f.phone,
        f.agreePrivacy,
        f.agreeMarketing,
        f.createdAt,
        f.normalized_email,
        ROW_NUMBER() OVER (PARTITION BY f.normalized_email ORDER BY f.createdAt DESC, f.id DESC) AS row_number,
        COUNT(*) OVER (PARTITION BY f.normalized_email) AS totalBookings
      FROM filtered AS f
    )
    SELECT
      r.id,
      r.name,
      r.email,
      r.phone,
      r.agreePrivacy,
      r.agreeMarketing,
      r.createdAt,
      r.totalBookings
    FROM ranked AS r
    WHERE r.row_number = 1
    ORDER BY r.createdAt DESC, r.id DESC
    ${paginationClause}
  `);

  return rows.map(mapContactRow);
}

export async function countContacts(filters: ContactFilterParams): Promise<number> {
  const whereClause = resolveContactsWhere(filters);
  const result = await prisma.$queryRaw<Array<{ total: bigint }>>(Prisma.sql`
    SELECT COUNT(*)::bigint AS total
    FROM (
      SELECT DISTINCT LOWER(TRIM(b.email)) AS normalized_email
      FROM "Booking" AS b
      ${whereClause}
    ) AS deduped
  `);

  const total = result[0]?.total ?? 0n;
  return Number(total);
}
