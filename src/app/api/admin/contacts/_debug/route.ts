import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

import { AdminUnauthorizedError, assertAdmin } from '@/lib/admin/session';
import { ORDER_BY } from '@/lib/admin/contacts-query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const EXPECTED_COLUMNS = [
  'full_name',
  'email',
  'phone',
  'last_contact_at',
  'privacy_consent',
  'newsletter_optin',
  'bookings_count',
];

export async function GET() {
  try {
    await assertAdmin();
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) {
      return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
    }
    throw error;
  }

  try {
    const prisma = (await import('@/lib/prisma')).prisma;

    const [registration] = await prisma.$queryRaw<{ reg: string | null }[]>(
      Prisma.sql`SELECT to_regclass('public.admin_contacts_view') AS reg;`,
    );

    const exists = Boolean(registration?.reg);
    let sample: { total: number; rows: Record<string, unknown>[] } | null = null;

    if (exists) {
      const [rows, totals] = await Promise.all([
        prisma.$queryRaw<Record<string, unknown>[]>(
          Prisma.sql`
            SELECT *
            FROM admin_contacts_view
            ${ORDER_BY}
            LIMIT 3
          `,
        ),
        prisma.$queryRaw<{ total: number }[]>(
          Prisma.sql`
            SELECT COUNT(*)::int AS total
            FROM admin_contacts_view
          `,
        ),
      ]);

      sample = {
        total: Number(totals[0]?.total ?? 0),
        rows,
      };
    }

    return NextResponse.json({
      ok: true,
      view: {
        name: 'admin_contacts_view',
        exists,
        sample,
      },
      expectedColumns: EXPECTED_COLUMNS,
      ts: new Date().toISOString(),
    });
  } catch (error) {
    const errorId = randomUUID();
    console.error('[admin/contacts/_debug]', { errorId, error });

    return NextResponse.json(
      {
        ok: false,
        code: 'UNEXPECTED',
        message: 'Errore inatteso durante la diagnostica',
        errorId,
      },
      { status: 500 },
    );
  }
}
