// src/lib/admin/contacts-query.ts
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export const CONTACTS_DEFAULT_PAGE_SIZE = 20;
export const CONTACTS_MAX_PAGE_SIZE = 100;

export type ContactsFilters = {
  search?: string;
  newsletter?: 'all' | 'true' | 'false';
  privacy?: 'all' | 'true' | 'false';
  from?: string;
  to?: string;
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

export type ContactsFiltersResult = {
  filters: ContactsFilters;
  whereClause: Prisma.Sql;
};

function parseBooleanChoice(value: string | null): 'true' | 'false' | 'all' {
  if (value === 'true') return 'true';
  if (value === 'false') return 'false';
  return 'all';
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

function parseContactsFilters(searchParams: URLSearchParams): ContactsFilters {
  const filters: ContactsFilters = {
    newsletter: parseBooleanChoice(searchParams.get('newsletter')),
    privacy: parseBooleanChoice(searchParams.get('privacy')),
  };

  const search = (searchParams.get('q') ?? searchParams.get('search') ?? '').trim();
  if (search) filters.search = search;

  const from = parseDateStart(searchParams.get('from'));
  if (from) filters.from = from;

  const to = parseDateEnd(searchParams.get('to'));
  if (to) filters.to = to;

  return filters;
}

export function buildContactsWhereClause(filters: ContactsFilters): { whereClause: Prisma.Sql } {
  const conditions: Prisma.Sql[] = [];

  if (filters.search) {
    const query = `%${filters.search.trim()}%`;
    conditions.push(
      Prisma.sql`(name ILIKE ${query} OR email ILIKE ${query} OR phone ILIKE ${query})`,
    );
  }

  if (filters.newsletter && filters.newsletter !== 'all') {
    const value = filters.newsletter === 'true';
    conditions.push(Prisma.sql`agreeMarketing = ${value}`);
  }

  if (filters.privacy && filters.privacy !== 'all') {
    const value = filters.privacy === 'true';
    conditions.push(Prisma.sql`agreePrivacy = ${value}`);
  }

  if (filters.from) {
    conditions.push(Prisma.sql`createdAt >= ${filters.from}`);
  }

  if (filters.to) {
    conditions.push(Prisma.sql`createdAt <= ${filters.to}`);
  }

  if (conditions.length === 0) {
    return { whereClause: Prisma.sql`` };
  }

  return {
    whereClause: Prisma.sql`WHERE ${Prisma.join(conditions, Prisma.sql` AND `)}`,
  };
}

export function buildContactsFilters(searchParams: URLSearchParams): ContactsFiltersResult {
  const filters = parseContactsFilters(searchParams);
  const { whereClause } = buildContactsWhereClause(filters);

  return {
    filters,
    whereClause,
  };
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
  limit = CONTACTS_DEFAULT_PAGE_SIZE,
  offset = 0,
}: {
  whereClause: Prisma.Sql;
  limit?: number;
  offset?: number;
}): Promise<{ items: ContactDTO[]; total: number }> {
  const rows = await prisma.$queryRaw<ContactQueryRow[]>(
    Prisma.sql`
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
        FROM "Booking"
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
      ORDER BY createdAt DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `,
  );

  const totalResult = await prisma.$queryRaw<Array<{ count: bigint }>>(
    Prisma.sql`
      SELECT COUNT(DISTINCT LOWER(TRIM(email)))::bigint AS count
      FROM "Booking"
      ${whereClause}
    `,
  );

  const total = totalResult[0]?.count ?? 0n;

  return {
    items: rows.map(mapContactRow),
    total: Number(total),
  };
}
