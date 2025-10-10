import { NextRequest, NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { ensureEventItemModel } from '@/utils/dev-guards';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const DEFAULT_LIMIT = 6;
const MAX_LIMIT = 50;
const EXCERPT_LENGTH = 240;

function parseLimit(rawLimit: string | null): number {
  if (!rawLimit) return DEFAULT_LIMIT;
  const parsed = Number.parseInt(rawLimit, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_LIMIT;
  }
  return Math.min(parsed, MAX_LIMIT);
}

function parseIncludePast(rawIncludePast: string | null): boolean {
  if (!rawIncludePast) return false;
  const normalized = rawIncludePast.trim().toLowerCase();
  return normalized === 'true' || normalized === '1' || normalized === 'yes';
}

function parseFromDate(rawFrom: string | null): Date {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  if (!rawFrom) {
    return today;
  }

  const match = rawFrom.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return today;
  }

  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day));
  parsed.setHours(0, 0, 0, 0);

  if (Number.isNaN(parsed.getTime())) {
    return today;
  }

  return parsed;
}

function createExcerpt(description: string | null): string | null {
  if (!description) return null;

  const trimmed = description.trim();
  const slice = trimmed.slice(0, EXCERPT_LENGTH);
  const needsEllipsis = trimmed.length > EXCERPT_LENGTH;

  return `${slice}${needsEllipsis ? '\u2026' : ''}`;
}

export async function GET(request: NextRequest) {
  try {
    ensureEventItemModel();

    const searchParams = request.nextUrl.searchParams;
    const limit = parseLimit(searchParams.get('limit'));
    const includePast = parseIncludePast(searchParams.get('includePast'));
    const fromDate = parseFromDate(searchParams.get('from'));

    const events = await prisma.eventItem.findMany({
      where: {
        active: true,
        showOnHome: true,
        ...(includePast
          ? {}
          : {
              startAt: {
                gte: fromDate,
              },
            }),
      },
      orderBy: { startAt: 'asc' },
      take: limit,
      select: {
        id: true,
        slug: true,
        title: true,
        description: true,
        startAt: true,
        endAt: true,
        showOnHome: true,
      },
    });

    const payload = events.map((event) => ({
      ...event,
      excerpt: createExcerpt(event.description ?? null),
    }));

    return NextResponse.json(payload);
  } catch (error) {
    console.error('[GET /api/events] error', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
