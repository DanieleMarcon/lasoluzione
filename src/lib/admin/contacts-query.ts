// src/lib/admin/contacts-query.ts
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export const CONTACTS_DEFAULT_PAGE_SIZE = 20;
export const CONTACTS_MAX_PAGE_SIZE = 100;

export type ContactFilters = {
  search?: string;
  newsletter?: 'all' | 'true' | 'false';
  privacy?: 'all' | 'true' | 'false';
  from?: string;
  to?: string;
};

export type ContactsWhere = {
  whereClause: Prisma.Sql;
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
  name: string | null;
  email: string | null;
  phone: string | null;
  agreePrivacy: number | boolean | null;
  agreeMarketing: number | boolean | null;
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
  skip: number;
};

function parseTriState(value: string | null): 'all' | 'true' | 'false' {
  if (value === 'true' || value === 'false') return value;
  return 'all';
}

function parseDateFrom(value: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function parseDateTo(value: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  return date.toISOString();
}

export function buildContactsFilters(searchParams: URLSearchParams): ContactFilters {
  const search = (searchParams.get('q') ?? searchParams.get('search') ?? '').trim();
  const normalizedSearch = search !== '' ? search : undefined;

  const newsletter = parseTriState(searchParams.get('newsletter'));
  const privacy = parseTriState(searchParams.get('privacy'));

  const from = parseDateFrom(searchParams.get('from'));
  const to = parseDateTo(searchParams.get('to'));

  return {
    search: normalizedSearch,
    newsletter,
    privacy,
    from,
    to,
  };
}

export function buildContactsWhere(filters: ContactFilters): ContactsWhere {
  const conditions: Prisma.Sql[] = [];

  if (filters.search && filters.search.trim() !== '') {
    const term = `%${filters.search.trim()}%`;
    conditions.push(
      Prisma.sql`(name ILIKE ${term} OR email ILIKE ${term} OR phone ILIKE ${term})`,
    );
  }

  if (filters.newsletter === 'true') conditions.push(Prisma.sql`agreeMarketing = true`);
  else if (filters.newsletter === 'false') conditions.push(Prisma.sql`agreeMarketing = false`);

  if (filters.privacy === 'true') conditions.push(Prisma.sql`agreePrivacy = true`);
  else if (filters.privacy === 'false') conditions.push(Prisma.sql`agreePrivacy = false`);

  if (filters.from) conditions.push(Prisma.sql`createdAt >= ${filters.from}`);
  if (filters.to) conditions.push(Prisma.sql`createdAt < ${filters.to}`);

  const whereClause =
    conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}`
      : Prisma.sql``;

  return { whereClause };
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

/**
 * Ritorna una riga per email (deduplicata), con conteggio totale prenotazioni.
 */
export async function fetchContactsData({
  whereClause,
  limit,
  offset = 0,
}: {
  whereClause: Prisma.Sql;
  limit?: number;
  offset?: number;
}): Promise<ContactDTO[]> {
  const paginationClause =
    typeof limit === 'number'
      ? Prisma.sql`LIMIT ${limit} OFFSET ${offset ?? 0}`
      : Prisma.sql``;

  const query = Prisma.sql`
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
      ${whereClause}
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
    ORDER BY createdAt DESC
    ${paginationClause}
  `;

  const rows = await prisma.$queryRaw<ContactQueryRow[]>(query);
  return rows.map(mapContactRow);
}
