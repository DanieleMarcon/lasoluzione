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

export function toYesNoAll(v: unknown): ContactTriState {
  const s = String(v ?? '').trim().toLowerCase();
  if (['true', '1', 'yes', 'y'].includes(s)) return 'yes';
  if (['false', '0', 'no', 'n'].includes(s)) return 'no';
  return 'all';
}

export function parseDateParam(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function parseCount(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'bigint') {
    return Number(value);
  }
  return undefined;
}

export function toContactDTO(row: any): ContactDTO {
  const last = row.lastContactAt ?? row.last_contact_at ?? null;

  const totalBookings = parseCount(row.totalBookings) ?? parseCount(row.total_bookings);
  const bookingsCount = parseCount(row.bookingsCount) ?? (typeof totalBookings === 'number' ? totalBookings : 0);

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

export async function queryAdminContacts({
  search,
  newsletter,
  privacy,
  from,
  to,
  limit,
  offset,
}: ContactQuery): Promise<{ rows: any[]; total: number }> {
  const rows = await prisma.$queryRaw<any[]>(
    Prisma.sql`select * from public.admin_contacts_search(
      ${search}, ${newsletter}, ${privacy}, ${from}, ${to}, ${limit}, ${offset}
    )`,
  );

  const totalRes = await prisma.$queryRaw<{ count: bigint }[]>(
    Prisma.sql`select count(*)::bigint as count
               from public.admin_contacts_search(
                 ${search}, ${newsletter}, ${privacy}, ${from}, ${to}, ${Prisma.sql`NULL`}, ${Prisma.sql`NULL`}
               )`,
  );

  const total = Number(totalRes?.[0]?.count ?? 0);

  return { rows, total };
}
