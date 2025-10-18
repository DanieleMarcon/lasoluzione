// src/lib/admin/contacts-query.ts
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export const CONTACTS_DEFAULT_PAGE_SIZE = 20;
export const CONTACTS_MAX_PAGE_SIZE = 200;

export type ContactFilters = {
  where: Prisma.Sql;
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
  last_contact_at: string | Date;
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
  const conditions: Prisma.Sql[] = [];

  const search = (searchParams.get('q') ?? searchParams.get('search') ?? '').trim();
  if (search) {
    const wildcard = `%${search.toLowerCase()}%`;
    conditions.push(
      Prisma.sql`(
        LOWER(TRIM(COALESCE(b."name", ''))) LIKE ${wildcard}
        OR LOWER(TRIM(b."email")) LIKE ${wildcard}
        OR LOWER(TRIM(COALESCE(b."phone", ''))) LIKE ${wildcard}
      )`,
    );
  }

  const newsletter = parseBooleanFilter(searchParams.get('newsletter'));
  if (newsletter !== null) {
    conditions.push(Prisma.sql`b."agreeMarketing" = ${newsletter}`);
  }

  const privacy = parseBooleanFilter(searchParams.get('privacy'));
  if (privacy !== null) {
    conditions.push(Prisma.sql`b."agreePrivacy" = ${privacy}`);
  }

  const from = parseDateStart(searchParams.get('from'));
  if (from) {
    conditions.push(Prisma.sql`b."createdAt" >= ${from}`);
  }

  const to = parseDateEnd(searchParams.get('to'));
  if (to) {
    conditions.push(Prisma.sql`b."createdAt" <= ${to}`);
  }

  const where = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, Prisma.sql` AND `)}` : Prisma.sql``;
  return { where };
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
    createdAt: toIsoString(row.last_contact_at),
    agreePrivacy: Boolean(row.agreePrivacy),
    agreeMarketing: Boolean(row.agreeMarketing),
    totalBookings: Number(row.totalBookings ?? 0),
  };
}

/**
 * Ritorna una riga per email (deduplicata), con conteggio totale prenotazioni.
 */
export async function fetchContactsData({
  where,
  limit,
  offset = 0,
}: {
  where: Prisma.Sql;
  limit?: number;
  offset?: number;
}): Promise<ContactDTO[]> {
  const paginationLimit = typeof limit === 'number' && Number.isFinite(limit) ? Math.max(0, limit) : null;
  const paginationOffset = typeof offset === 'number' && Number.isFinite(offset) ? Math.max(0, offset) : 0;

  const paginationClause =
    paginationLimit !== null ? Prisma.sql`LIMIT ${paginationLimit} OFFSET ${paginationOffset}` : Prisma.sql``;

  const query = Prisma.sql`
    WITH filtered AS (
      SELECT
        b."id",
        TRIM(b."name") AS "name",
        TRIM(b."email") AS "email",
        LOWER(TRIM(COALESCE(b."email", ''))) AS "normalizedEmail",
        TRIM(b."phone") AS "phone",
        b."agreePrivacy",
        b."agreeMarketing",
        b."createdAt"
      FROM "Booking" b
      ${where}
    ),
    ranked AS (
      SELECT
        "id",
        "name",
        "email",
        "phone",
        "agreePrivacy",
        "agreeMarketing",
        "createdAt",
        "normalizedEmail",
        ROW_NUMBER() OVER (PARTITION BY "normalizedEmail" ORDER BY "createdAt" DESC, "id" DESC) AS "rowNumber",
        COUNT(*) OVER (PARTITION BY "normalizedEmail") AS "totalBookings"
      FROM filtered
    )
    SELECT
      "name",
      "email",
      "phone",
      "agreePrivacy",
      "agreeMarketing",
      "createdAt" AS "last_contact_at",
      "totalBookings"
    FROM ranked
    WHERE "rowNumber" = 1
    ORDER BY "last_contact_at" DESC, "email" ASC
    ${paginationClause}
  `;

  const rows = await prisma.$queryRaw<ContactQueryRow[]>(query);
  return rows.map(mapContactRow);
}
