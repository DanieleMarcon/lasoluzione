import { Prisma } from '@prisma/client';
import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

import { AdminUnauthorizedError, assertAdmin } from '@/lib/admin/session';
import {
  buildContactsFilters,
  resolveContactsPagination,
  fetchContactsData,
} from '@/lib/admin/contacts-query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function isMissingViewError(error: unknown): boolean {
  if (!error) return false;

  if (typeof error === 'object' && 'code' in (error as any)) {
    const code = (error as { code?: unknown }).code;
    if (code === '42P01') {
      return true;
    }
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2010') {
      const meta = error.meta as { code?: string } | undefined;
      if (meta?.code === '42P01') {
        return true;
      }
    }
  }

  const cause = (error as { cause?: unknown }).cause;
  if (cause) {
    return isMissingViewError(cause);
  }

  return false;
}

export async function GET(req: Request) {
  try {
    await assertAdmin();
  } catch (error) {
    if (error instanceof AdminUnauthorizedError) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    throw error;
  }

  const { searchParams } = new URL(req.url);
  const filters = buildContactsFilters(searchParams);
  const { page, pageSize, skip } = resolveContactsPagination(searchParams);

  try {
    const prisma = (await import('@/lib/prisma')).prisma;
    const [items, totalRows] = await Promise.all([
      fetchContactsData({
        whereClause: filters.whereClause,
        limit: pageSize,
        offset: skip,
      }),
      prisma.$queryRaw<{ total: number }[]>(
        Prisma.sql`
          SELECT COUNT(*)::int AS total
          FROM admin_contacts_view
          ${filters.whereClause}
        `,
      ),
    ]);

    const total = Number(totalRows[0]?.total ?? 0);
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;

    return NextResponse.json({
      items,
      page,
      pageSize,
      total,
      totalPages,
    });
  } catch (err) {
    const errorId = randomUUID();
    console.error('[admin/contacts]', { errorId, err });

    if (isMissingViewError(err)) {
      return Response.json(
        {
          ok: false,
          code: 'MISSING_VIEW',
          message: 'La view public.admin_contacts_view non esiste',
          next: '/api/admin/contacts/_debug',
          errorId,
        },
        { status: 501 },
      );
    }

    return Response.json(
      {
        ok: false,
        code: 'UNEXPECTED',
        message: 'Errore inatteso',
        errorId,
      },
      { status: 500 },
    );
  }
}
