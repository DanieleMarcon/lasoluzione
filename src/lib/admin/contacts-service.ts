import { Prisma } from '@prisma/client';
import { performance } from 'node:perf_hooks';

import type { ContactDTO } from '@/types/admin/contacts';
import { prisma } from '@/lib/prisma';

const ADMIN_CONTACTS_HIDDEN_TABLE_DDL = Prisma.sql`
  create table if not exists public.admin_contacts_hidden(
    email     text primary key,
    hidden    boolean not null default true,
    hidden_at timestamptz not null default now(),
    hidden_by text
  )
`;

function isMissingHiddenTableError(error: unknown) {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const err = error as Record<string, any>;
  const codeCandidates: Array<unknown> = [err.code, err?.meta?.code, err?.original?.code];
  if (codeCandidates.some((code) => code === '42P01')) {
    return true;
  }

  const message = typeof err.message === 'string' ? err.message.toLowerCase() : '';
  if (message.includes('42p01')) return true;
  if (message.includes('admin_contacts_hidden') && message.includes('does not exist')) return true;

  return false;
}

export async function ensureAdminContactsHiddenTable() {
  await prisma.$executeRaw(ADMIN_CONTACTS_HIDDEN_TABLE_DDL);
}

export async function withAdminContactsHiddenGuard<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (!isMissingHiddenTableError(error)) {
      throw error;
    }
  }

  await ensureAdminContactsHiddenTable();
  return operation();
}

export type ContactTriState = 'yes' | 'no' | 'all';

export type ContactQuery = {
  search: string | null;
  newsletter: ContactTriState;
  privacy: ContactTriState;
  from: Date | null;
  to: Date | null;
  limit: number;
  offset: number;
};

export type ContactsQueryLogStage =
  | 'sql:with_total'
  | 'sql:fallback:data'
  | 'sql:fallback:count';

export type ContactsQueryLogEntry = {
  stage: ContactsQueryLogStage;
  durations?: { stageMs: number; totalMs: number };
  sqlArgs?: Record<string, unknown>;
  error?: true;
  fingerprint?: { name?: string; code?: string; message?: string };
};

export type QueryAdminContactsOptions = {
  logger?: (entry: ContactsQueryLogEntry) => void;
};

export function toYesNoAll(v: unknown): ContactTriState {
  const s = String(v ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(s)) return 'yes';
  if (['false', '0', 'no', 'n'].includes(s)) return 'no';
  return 'all';
}

function legacyParseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function parseDateOrNull(v: unknown): Date | null {
  try {
    return legacyParseDateParam(v as string | null);
  } catch {
    // fallback inline implementation
  }

  const s = String(v ?? '').trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** @deprecated use parseDateOrNull */
export const parseDateParam = parseDateOrNull as any;

function parseCount(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  return undefined;
}

export function toContactDTO(row: any): ContactDTO {
  const last = row.lastContactAt ?? row.last_contact_at ?? null;

  const totalBookings = parseCount(row.totalBookings) ?? parseCount(row.total_bookings);
  const bookingsCount = parseCount(row.bookingsCount) ?? (totalBookings ?? 0);

  const lastDate = last ? String(last) : null;

  return {
    name: row.name ?? null,
    email: row.email,
    phone: row.phone ?? null,
    lastContactAt: lastDate,
    createdAt: lastDate,
    privacy: typeof row.privacy === 'boolean' ? row.privacy : null,
    newsletter: typeof row.newsletter === 'boolean' ? row.newsletter : null,
    bookingsCount,
    totalBookings,
  };
}

export async function reconcileContactConsents(rows: Array<Record<string, any>>) {
  const emails = Array.from(new Set(rows.map((r) => r.email).filter(Boolean))).map((email) =>
    String(email).toLowerCase(),
  );

  if (!emails.length) {
    return;
  }

  const consentRows = await prisma.$queryRaw<
    { email: string; privacy: boolean; newsletter: boolean }[]
  >(Prisma.sql`
    with consents as (
      select
        lower(b."email")                               as email,
        bool_or(coalesce(b."agreePrivacy",   false))   as privacy,
        bool_or(coalesce(b."agreeMarketing", false))   as newsletter
      from public."Booking" b
      where lower(b."email") = any(${emails}::text[])
      group by 1
    )
    select email, privacy, newsletter
    from consents
  `);

  const byEmail = new Map(consentRows.map((row) => [row.email, row] as const));

  for (const row of rows) {
    const key = row.email?.toLowerCase?.();
    const consent = key ? byEmail.get(key) : undefined;
    if (consent) {
      row.privacy = consent.privacy;
      row.newsletter = consent.newsletter;
    }
  }
}

function buildSqlArgs({ search, newsletter, privacy, from, to, limit, offset }: ContactQuery) {
  return {
    search,
    newsletter,
    privacy,
    from: from ? from.toISOString() : null,
    to: to ? to.toISOString() : null,
    limit,
    offset,
  } satisfies Record<string, unknown>;
}

function buildErrorFingerprint(error: unknown) {
  if (!error || typeof error !== 'object') {
    return { name: typeof error, message: typeof error === 'string' ? error : undefined };
  }

  const err = error as Record<string, any>;
  const message: string | undefined = typeof err.message === 'string' ? err.message.split('\n')[0] : undefined;

  const code =
    typeof err.code === 'string'
      ? err.code
      : typeof err?.meta?.code === 'string'
        ? err.meta.code
        : typeof err?.original?.code === 'string'
          ? err.original.code
          : undefined;

  return {
    name: typeof err.name === 'string' ? err.name : undefined,
    code,
    message,
  };
}

function isMissingFunctionError(error: unknown) {
  if (!error) return false;

  const err = error as Record<string, any>;

  const codeCandidates: Array<unknown> = [err.code, err?.meta?.code, err?.original?.code];
  if (codeCandidates.some((code) => code === '42883')) {
    return true;
  }

  const message = typeof err.message === 'string' ? err.message.toLowerCase() : '';

  if (message.includes('42883')) return true;
  if (message.includes('admin_contacts_search_with_total') && message.includes('does not exist')) return true;

  return false;
}

export async function queryAdminContacts(
  query: ContactQuery,
  options: QueryAdminContactsOptions = {},
): Promise<{ rows: any[]; total: number }> {
  const { logger } = options;
  const sqlArgs = buildSqlArgs(query);
  const castedArgs = Prisma.sql`
    ${sqlArgs.search}::text,
    ${sqlArgs.newsletter}::text,
    ${sqlArgs.privacy}::text,
    ${sqlArgs.from}::date,
    ${sqlArgs.to}::date,
    ${sqlArgs.limit}::int,
    ${sqlArgs.offset}::int
  `;
  const start = performance.now();

  const withTotalStart = performance.now();

  try {
    const rows = await withAdminContactsHiddenGuard(() =>
      prisma.$queryRaw<any[]>(
        Prisma.sql`
          select v.*, count(*) over() as filtered_total_count
          from (
            select * from public.admin_contacts_search_with_total(${castedArgs})
          ) as v
          left join public.admin_contacts_hidden h on lower(v.email) = h.email
          where coalesce(h.hidden, false) = false
        `,
      ),
    );

    const stageDuration = performance.now() - withTotalStart;
    logger?.({
      stage: 'sql:with_total',
      sqlArgs,
      durations: { stageMs: stageDuration, totalMs: performance.now() - start },
    });

    const total = Number(rows?.[0]?.filtered_total_count ?? rows?.[0]?.total_count ?? rows.length ?? 0);

    return { rows, total };
  } catch (error) {
    const stageDuration = performance.now() - withTotalStart;
    logger?.({
      stage: 'sql:with_total',
      sqlArgs,
      durations: { stageMs: stageDuration, totalMs: performance.now() - start },
      error: true,
      fingerprint: buildErrorFingerprint(error),
    });

    if (!isMissingFunctionError(error)) {
      throw error;
    }
  }

  const fallbackDataStart = performance.now();
  const rows = await withAdminContactsHiddenGuard(() =>
    prisma.$queryRaw<any[]>(
      Prisma.sql`
        select v.*
        from (
          select * from public.admin_contacts_search(${castedArgs})
        ) as v
        left join public.admin_contacts_hidden h on lower(v.email) = h.email
        where coalesce(h.hidden, false) = false
      `,
    ),
  );

  logger?.({
    stage: 'sql:fallback:data',
    sqlArgs,
    durations: { stageMs: performance.now() - fallbackDataStart, totalMs: performance.now() - start },
  });

  const fallbackCountStart = performance.now();
  const totalRes = await withAdminContactsHiddenGuard(() =>
    prisma.$queryRaw<{ count: bigint }[]>(
      Prisma.sql`
        select count(*)::bigint as count
        from (
          select 1
          from (
            select * from public.admin_contacts_search(${castedArgs})
          ) as v
          left join public.admin_contacts_hidden h on lower(v.email) = h.email
          where coalesce(h.hidden, false) = false
        ) as s
      `,
    ),
  );

  logger?.({
    stage: 'sql:fallback:count',
    sqlArgs,
    durations: { stageMs: performance.now() - fallbackCountStart, totalMs: performance.now() - start },
  });

  const total = Number(totalRes?.[0]?.count ?? 0);

  return { rows, total };
}
