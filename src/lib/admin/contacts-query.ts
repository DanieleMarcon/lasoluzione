import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';

export const CONTACTS_DEFAULT_PAGE_SIZE = 20;
export const CONTACTS_MAX_PAGE_SIZE = 200;

export type ContactsFilters = {
  search?: string | null;
  newsletter?: 'all' | 'true' | 'false';
  privacy?: 'all' | 'true' | 'false';
  from?: string | null;
  to?: string | null;
  page?: number;
  pageSize?: number;
};

export type NormalizedContactsFilters = {
  search: string | null;
  newsletter: 'all' | 'true' | 'false';
  privacy: 'all' | 'true' | 'false';
  from: string | null;
  to: string | null;
  page: number;
  pageSize: number;
  limit: number;
  offset: number;
};

type BuildFiltersOptions = {
  defaultPageSize?: number;
  maxPageSize?: number;
};

type AdminContactsRow = {
  name: string | null;
  email: string | null;
  phone: string | null;
  last_contact_at: Date | string | null;
  privacy: boolean | null;
  newsletter: boolean | null;
  total_bookings: number | null;
};

export type ContactDTO = {
  name: string;
  email: string;
  phone: string;
  createdAt: string;
  lastContactAt: string;
  agreePrivacy: boolean;
  agreeMarketing: boolean;
  totalBookings: number;
};

function toNullableString(value: unknown) {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeSearch(value: unknown) {
  const search = toNullableString(value);
  return search;
}

function normalizeTriState(value: unknown): 'all' | 'true' | 'false' {
  if (value === 'true' || value === true) return 'true';
  if (value === 'false' || value === false) return 'false';
  return 'all';
}

function normalizeDate(value: unknown): string | null {
  const dateString = toNullableString(value);
  if (!dateString) return null;
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return null;
  return dateString.slice(0, 10);
}

function toInteger(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.trunc(value);
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number.parseInt(trimmed, 10);
    if (!Number.isFinite(parsed)) return null;
    return parsed;
  }
  return null;
}

function normalizePage(value: unknown, fallback: number) {
  const parsed = toInteger(value);
  if (parsed == null || parsed < 1) return fallback;
  return parsed;
}

function normalizePageSize(value: unknown, fallback: number, max: number) {
  const parsed = toInteger(value);
  if (parsed == null || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

export function buildContactsFilters(
  input: ContactsFilters = {},
  options: BuildFiltersOptions = {},
): NormalizedContactsFilters {
  const defaultPageSize = options.defaultPageSize ?? CONTACTS_DEFAULT_PAGE_SIZE;
  const maxPageSize = options.maxPageSize ?? CONTACTS_MAX_PAGE_SIZE;

  const search = normalizeSearch(input.search ?? null);
  const newsletter = normalizeTriState(input.newsletter);
  const privacy = normalizeTriState(input.privacy);
  const from = normalizeDate(input.from ?? null);
  const to = normalizeDate(input.to ?? null);
  const page = normalizePage(input.page, 1);
  const pageSize = normalizePageSize(input.pageSize, defaultPageSize, maxPageSize);
  const limit = pageSize;
  const offset = (page - 1) * pageSize;

  return { search, newsletter, privacy, from, to, page, pageSize, limit, offset };
}

function mapRowToContact(row: AdminContactsRow): ContactDTO {
  const lastContactAt = (() => {
    if (!row.last_contact_at) return '';
    const date = row.last_contact_at instanceof Date ? row.last_contact_at : new Date(row.last_contact_at);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString();
  })();

  return {
    name: row.name?.trim() ?? '',
    email: row.email?.trim() ?? '',
    phone: row.phone?.trim() ?? '',
    createdAt: lastContactAt,
    lastContactAt,
    agreePrivacy: Boolean(row.privacy),
    agreeMarketing: Boolean(row.newsletter),
    totalBookings: Number(row.total_bookings ?? 0),
  };
}

export async function fetchContactsData({
  filters,
}: {
  filters: NormalizedContactsFilters;
}): Promise<{ items: ContactDTO[]; total: number }> {
  const limit = filters.limit;
  const offset = filters.offset;

  const rows = await prisma.$queryRaw<Array<AdminContactsRow>>(Prisma.sql`
    select * from public.admin_contacts_search(
      ${filters.search ?? null},
      ${filters.newsletter ?? 'all'},
      ${filters.privacy ?? 'all'},
      ${filters.from ?? null}::date,
      ${filters.to ?? null}::date,
      ${limit},
      ${offset}
    )
  `);

  const [{ count }] = await prisma.$queryRaw<{ count: bigint }[]>(Prisma.sql`
    select count(*)::bigint as count
    from public.admin_contacts_search(
      ${filters.search ?? null},
      ${filters.newsletter ?? 'all'},
      ${filters.privacy ?? 'all'},
      ${filters.from ?? null}::date,
      ${filters.to ?? null}::date,
      1000000,
      0
    )
  `);

  const safeCount = count > BigInt(Number.MAX_SAFE_INTEGER)
    ? BigInt(Number.MAX_SAFE_INTEGER)
    : count;
  const total = Number(safeCount);

  return {
    items: rows.map(mapRowToContact),
    total,
  };
}

