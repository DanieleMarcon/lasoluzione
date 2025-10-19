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
  name: string | null;
  email: string | null;
  phone: string | null;
  last_contact_at: Date | null;
  privacy_opt_in: boolean | null;
  newsletter_opt_in: boolean | null;
  bookings_count: number;
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

function parseDateStart(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function parseDateEnd(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 1);
  return date;
}

export function buildContactsFilters(searchParams: URLSearchParams): ContactFilters {
  const conditions: Prisma.Sql[] = [];

  const search = (searchParams.get('q') ?? searchParams.get('search') ?? '').trim();
  if (search) {
    const wildcard = `%${search.trim()}%`;
    conditions.push(
      Prisma.sql`(name ILIKE ${wildcard} OR email ILIKE ${wildcard} OR phone ILIKE ${wildcard})`,
    );
  }

  const newsletter = parseBooleanFilter(searchParams.get('newsletter'));
  if (newsletter !== null) {
    conditions.push(Prisma.sql`newsletter_opt_in = ${newsletter}`);
  }

  const privacy = parseBooleanFilter(searchParams.get('privacy'));
  if (privacy !== null) {
    conditions.push(Prisma.sql`privacy_opt_in = ${privacy}`);
  }

  const from = parseDateStart(searchParams.get('from'));
  if (from) {
    conditions.push(Prisma.sql`last_contact_at >= ${from}`);
  }

  const to = parseDateEnd(searchParams.get('to'));
  if (to) {
    conditions.push(Prisma.sql`last_contact_at < ${to}`);
  }

  if (conditions.length === 0) {
    return { whereClause: Prisma.sql`` };
  }

  return { whereClause: Prisma.sql`WHERE ${Prisma.join(conditions, Prisma.sql` AND `)}` };
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

function toIsoString(value: string | Date | null) {
  if (!value) return new Date().toISOString();
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
    agreePrivacy: Boolean(row.privacy_opt_in),
    agreeMarketing: Boolean(row.newsletter_opt_in),
    totalBookings: Number(row.bookings_count ?? 0),
  };
}

type FetchContactsOptions = {
  whereClause: Prisma.Sql;
  limit?: number;
  offset?: number;
  /** opzionale: lasciata per retro-compatibilità con i call-site esistenti */
  params?: unknown[];
};

export async function fetchContactsData({
  whereClause,
  limit = CONTACTS_DEFAULT_PAGE_SIZE,
  offset = 0,
}: FetchContactsOptions): Promise<ContactDTO[]> {
  const rows = await prisma.$queryRaw<ContactQueryRow[]>(
    Prisma.sql`
      SELECT
        name,
        email,
        phone,
        last_contact_at,
        privacy_opt_in,
        newsletter_opt_in,
        bookings_count
      FROM admin_contacts_view
      ${whereClause}
      ORDER BY last_contact_at DESC NULLS LAST
      LIMIT ${limit} OFFSET ${offset}
    `,
  );

  return rows.map(mapContactRow);
}
