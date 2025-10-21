import { Prisma } from '@prisma/client';

import type { ContactDTO } from '@/types/admin/contacts';
import { prisma } from '@/lib/prisma';

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

export type ContactQueryLogContext = {
  requestId?: string | null;
  stage?: string | null;
  fingerprint?: string;
};

export function toYesNoAll(v: unknown): ContactTriState {
  const s = String(v ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(s)) return 'yes';
  if (['false', '0', 'no', 'n'].includes(s)) return 'no';
  return 'all';
}

export function parseDateOrNull(v: unknown): Date | null {
  const s = String(v ?? '').trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toNumberOrNull(value: unknown): number | null {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  if (typeof value === 'string') {
    const parsed = Number.parseInt(value, 10);
    return Number.isNaN(parsed) ? null : parsed;
  }
  return null;
}

function toStringOrNull(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString();
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  return String(value);
}

function serializeQuery(query: ContactQuery) {
  return {
    search: query.search,
    newsletter: query.newsletter,
    privacy: query.privacy,
    from: query.from ? query.from.toISOString() : null,
    to: query.to ? query.to.toISOString() : null,
    limit: query.limit,
    offset: query.offset,
  };
}

export function toContactDTO(row: any): ContactDTO {
  const lastContactAt = toStringOrNull(row.last_contact_at);
  const totalBookings = toNumberOrNull(row.total_bookings) ?? 0;

  return {
    name: row.name ?? null,
    email: row.email,
    phone: row.phone ?? null,
    lastContactAt,
    createdAt: lastContactAt,
    privacy: typeof row.privacy === 'boolean' ? row.privacy : null,
    newsletter: typeof row.newsletter === 'boolean' ? row.newsletter : null,
    bookingsCount: totalBookings,
    totalBookings,
  };
}

export async function queryAdminContacts(
  query: ContactQuery,
  logContext: ContactQueryLogContext = {},
): Promise<{ rows: any[]; total: number }> {
  const start = Date.now();

  const rows = await prisma.$queryRaw<any[]>(
    Prisma.sql`select * from public.admin_contacts_search_with_total(
      ${query.search},
      ${query.newsletter},
      ${query.privacy},
      ${query.from},
      ${query.to},
      ${query.limit},
      ${query.offset}
    )`,
  );

  const total = toNumberOrNull(rows?.[0]?.total_count) ?? 0;

  if (process.env.NODE_ENV !== 'production') {
    const stage =
      logContext.stage ??
      process.env.APP_STAGE ??
      process.env.VERCEL_ENV ??
      process.env.NODE_ENV ??
      null;

    console.info('admin_contacts_search_with_total', {
      requestId: logContext.requestId ?? null,
      stage,
      queryNormalized: serializeQuery(query),
      sqlArgs: [
        query.search,
        query.newsletter,
        query.privacy,
        query.from,
        query.to,
        query.limit,
        query.offset,
      ],
      durations: { totalMs: Date.now() - start },
      fingerprint: logContext.fingerprint ?? 'api/admin/contacts',
    });
  }

  return { rows, total };
}
