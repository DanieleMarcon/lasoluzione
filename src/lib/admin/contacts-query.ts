import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';

export const CONTACTS_DEFAULT_PAGE_SIZE = 20;
export const CONTACTS_MAX_PAGE_SIZE = 100;

export type ContactsFilters = {
  search?: string;
  privacy?: 'all' | 'true' | 'false';
  newsletter?: 'all' | 'true' | 'false';
  from?: string;
  to?: string;
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
  id: number;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  last_contact_at: Date | string | null;
  privacy_consent: boolean | null;
  newsletter_optin: boolean | null;
  bookings_count: number | null;
};

function normalizeBooleanFilter(value: string | null): 'all' | 'true' | 'false' {
  if (value === 'true' || value === 'false') return value;
  return 'all';
}

function parseDateStart(value: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

function parseDateEnd(value: string | null): string | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
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

function mapContactRow(row: ContactQueryRow): ContactDTO {
  return {
    name: row.full_name?.trim() ?? '',
    email: row.email?.trim() ?? '',
    phone: row.phone?.trim() ?? '',
    createdAt: toIsoString(row.last_contact_at),
    agreePrivacy: Boolean(row.privacy_consent),
    agreeMarketing: Boolean(row.newsletter_optin),
    totalBookings: Number(row.bookings_count ?? 0),
  };
}

export function parseContactsFilters(searchParams: URLSearchParams): ContactsFilters {
  const query = (searchParams.get('q') ?? searchParams.get('search') ?? '').trim();
  const search = query.length > 0 ? query : undefined;

  const privacy = normalizeBooleanFilter(searchParams.get('privacy'));
  const newsletter = normalizeBooleanFilter(searchParams.get('newsletter'));
  const from = parseDateStart(searchParams.get('from'));
  const to = parseDateEnd(searchParams.get('to'));

  return {
    search,
    privacy,
    newsletter,
    from,
    to,
  };
}

export function buildContactsWhere(filters: ContactsFilters): Prisma.Sql {
  const conditions: Prisma.Sql[] = [];

  const search = filters.search?.trim();
  if (search) {
    const wildcard = `%${search}%`;
    conditions.push(
      Prisma.sql`(c.full_name ILIKE ${wildcard} OR c.email ILIKE ${wildcard} OR c.phone ILIKE ${wildcard})`,
    );
  }

  if (filters.privacy === 'true') conditions.push(Prisma.sql`c.privacy_consent = true`);
  if (filters.privacy === 'false') conditions.push(Prisma.sql`c.privacy_consent = false`);

  if (filters.newsletter === 'true') conditions.push(Prisma.sql`c.newsletter_optin = true`);
  if (filters.newsletter === 'false') conditions.push(Prisma.sql`c.newsletter_optin = false`);

  if (filters.from) {
    const fromDate = new Date(filters.from);
    if (!Number.isNaN(fromDate.getTime())) {
      conditions.push(Prisma.sql`c.last_contact_at >= ${fromDate}`);
    }
  }

  if (filters.to) {
    const toDate = new Date(filters.to);
    if (!Number.isNaN(toDate.getTime())) {
      conditions.push(Prisma.sql`c.last_contact_at < ${toDate} + interval '1 day'`);
    }
  }

  if (conditions.length === 0) return Prisma.sql``;
  return Prisma.sql`WHERE ${Prisma.join(conditions, Prisma.sql` AND `)}`;
}

export function resolveContactsPagination(
  searchParams: URLSearchParams,
  options: PaginationOptions = {},
): PaginationResult {
  const defaultPageSize = options.defaultPageSize ?? CONTACTS_DEFAULT_PAGE_SIZE;
  const maxPageSize = options.maxPageSize ?? CONTACTS_MAX_PAGE_SIZE;

  const rawPage = Number(searchParams.get('page') ?? '1');
  const normalizedPage = Number.isFinite(rawPage) && rawPage > 0 ? Math.floor(rawPage) : 1;

  const rawSize = Number(searchParams.get('pageSize') ?? String(defaultPageSize));
  const normalizedSize = Number.isFinite(rawSize) && rawSize > 0 ? Math.floor(rawSize) : defaultPageSize;
  const pageSize = Math.min(Math.max(normalizedSize, 1), maxPageSize);

  const page = normalizedPage;
  const skip = (page - 1) * pageSize;

  return { page, pageSize, skip };
}

export async function fetchContactsData({
  filters,
  limit,
  offset,
}: {
  filters: ContactsFilters;
  limit?: number;
  offset?: number;
}): Promise<ContactDTO[]> {
  const safeLimit = typeof limit === 'number' && Number.isFinite(limit) && limit > 0 ? Math.floor(limit) : undefined;
  const safeOffset = typeof offset === 'number' && Number.isFinite(offset) && offset > 0 ? Math.floor(offset) : undefined;

  const where = buildContactsWhere(filters);

  const limitClause = safeLimit != null ? Prisma.sql`LIMIT ${safeLimit}` : Prisma.sql``;
  const offsetClause = safeOffset != null ? Prisma.sql`OFFSET ${safeOffset}` : Prisma.sql``;

  const rows = await prisma.$queryRaw<ContactQueryRow[]>(Prisma.sql`
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
    ${limitClause}
    ${offsetClause}
  `);

  return rows.map(mapContactRow);
}
