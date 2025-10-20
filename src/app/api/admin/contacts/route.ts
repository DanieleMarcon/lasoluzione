import { NextResponse } from 'next/server';
import { AdminUnauthorizedError, assertAdmin } from '@/lib/admin/session';
import { fetchContactsData } from '@/lib/admin/contacts-query';
import { resolveContactsFiltersWithPage } from '@/app/api/admin/contacts/filters';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    await assertAdmin();
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw error;
  }

  let queryLog: Record<string, string> = {};
  try {
    const { searchParams } = new URL(req.url);
    const { filters, pagination, queryLog: resolvedLog } = resolveContactsFiltersWithPage(searchParams);
    queryLog = resolvedLog;

    const { items, total } = await fetchContactsData({ filters });

    const data = items.map((row) => {
      const legacyRow = row as Record<string, unknown>;
      const rawTotalBookings = legacyRow.totalBookings ?? legacyRow.total_bookings ?? 0;
      const totalBookings = typeof rawTotalBookings === 'number'
        ? rawTotalBookings
        : Number(rawTotalBookings) || 0;
      const bookingsCountRaw = legacyRow.bookingsCount ?? legacyRow.bookings_count ?? totalBookings;
      const bookingsCount = typeof bookingsCountRaw === 'number'
        ? bookingsCountRaw
        : Number(bookingsCountRaw) || 0;

      const lastContactAtRaw =
        legacyRow.lastContactAt ?? legacyRow.last_contact_at ?? legacyRow.createdAt ?? legacyRow.created_at ?? null;
      let lastContactAt: string | null = null;
      if (typeof lastContactAtRaw === 'string') {
        lastContactAt = lastContactAtRaw || null;
      } else if (lastContactAtRaw instanceof Date) {
        lastContactAt = Number.isNaN(lastContactAtRaw.getTime()) ? null : lastContactAtRaw.toISOString();
      }
      if (!lastContactAt && typeof row.createdAt === 'string' && row.createdAt) {
        lastContactAt = row.createdAt;
      }

      return {
        ...row,
        totalBookings,
        bookingsCount,
        lastContactAt,
        createdAt: lastContactAt,
        privacy: Boolean((legacyRow.privacy ?? legacyRow.agreePrivacy ?? row.agreePrivacy) as boolean | null | undefined),
        newsletter: Boolean(
          (legacyRow.newsletter ?? legacyRow.agreeNewsletter ?? row.agreeMarketing ?? row.agreeNewsletter) as
            | boolean
            | null
            | undefined,
        ),
        agreeNewsletter: Boolean(
          (legacyRow.agreeNewsletter ?? legacyRow.newsletter ?? row.agreeMarketing ?? row.agreeNewsletter) as
            | boolean
            | null
            | undefined,
        ),
      };
    });

    return NextResponse.json({ data, total, page: pagination.page, pageSize: pagination.pageSize });
  } catch (error: any) {
    console.error(
      JSON.stringify({
        route: '/api/admin/contacts',
        query: queryLog,
        errorCode: error?.code ?? 'unknown',
      }),
    );
    return NextResponse.json({ error: 'INTERNAL_SERVER_ERROR' }, { status: 500 });
  }
}
