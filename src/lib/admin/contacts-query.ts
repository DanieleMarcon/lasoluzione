// src/lib/admin/contacts-query.ts
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const CONTACTS_DEFAULT_PAGE_SIZE = 20;
export const CONTACTS_MAX_PAGE_SIZE = 100;

export type ContactFilters = {
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
  full_name: string | null;
  email: string | null;
  phone: string | null;
  last_contact_at: string | Date | null;
  privacy_consent: boolean | number | null;
  newsletter_optin: boolean | number | null;
  bookings_count: number | bigint | null;
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
      Prisma.sql`(LOWER(full_name) LIKE ${wildcard} OR LOWER(email) LIKE ${wildcard} OR LOWER(phone) LIKE ${wildcard})`,
    );
  }

  const newsletter = parseBooleanFilter(searchParams.get('newsletter'));
  if (newsletter !== null) {
    conditions.push(Prisma.sql`newsletter_optin = ${newsletter}`);
  }

  const privacy = parseBooleanFilter(searchParams.get('privacy'));
  if (privacy !== null) {
    conditions.push(Prisma.sql`privacy_consent = ${privacy}`);
  }

  const from = parseDateStart(searchParams.get('from'));
  if (from) {
    conditions.push(Prisma.sql`last_contact_at >= ${from}`);
  }

  const to = parseDateEnd(searchParams.get('to'));
  if (to) {
    conditions.push(Prisma.sql`last_contact_at <= ${to}`);
  }

  const whereClause =
    conditions.length > 0
      ? Prisma.sql`WHERE ${Prisma.join(conditions, Prisma.sql` AND `)}`
      : Prisma.sql``;

  return { whereClause };
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

  const skip = (page - 1) * pageSize;
  return { page, pageSize, skip };
}

function toIsoString(value: string | Date | null | undefined) {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string') {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
      return date.toISOString();
    }
  }
  return new Date().toISOString();
}

function normalizeBoolean(value: boolean | number | null | undefined) {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  return false;
}

function normalizeCount(value: number | bigint | null | undefined) {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  return 0;
}

function mapContactRow(row: ContactQueryRow): ContactDTO {
  return {
    name: row.full_name?.trim() ?? '',
    email: row.email?.trim() ?? '',
    phone: row.phone?.trim() ?? '',
    createdAt: toIsoString(row.last_contact_at),
    agreePrivacy: normalizeBoolean(row.privacy_consent),
    agreeMarketing: normalizeBoolean(row.newsletter_optin),
    totalBookings: normalizeCount(row.bookings_count),
  };
}

export const ORDER_BY = Prisma.sql`ORDER BY last_contact_at DESC NULLS LAST, email ASC`;

export function buildLimitOffset(limit: number, offset: number) {
  return Prisma.sql`LIMIT ${limit} OFFSET ${offset}`;
}

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
    typeof limit === 'number' ? buildLimitOffset(limit, offset) : Prisma.sql``;

  const query = Prisma.sql`
    SELECT
      full_name,
      email,
      phone,
      last_contact_at,
      privacy_consent,
      newsletter_optin,
      bookings_count
    FROM admin_contacts_view
    ${whereClause}
    ${ORDER_BY}
    ${paginationClause}
  `;

  const rows = await prisma.$queryRaw<ContactQueryRow[]>(query);
  return rows.map(mapContactRow);
}
