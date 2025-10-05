import type { BookingStatus, BookingType, Prisma } from '@prisma/client';

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

function parseInteger(value: string | null, fallback: number) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) || parsed <= 0 ? fallback : parsed;
}

function parseDate(value: string | null) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export type AdminBookingQuery = {
  page: number;
  pageSize: number;
  skip: number;
  where: Prisma.BookingWhereInput;
};

export function buildAdminBookingQuery(searchParams: URLSearchParams): AdminBookingQuery {
  const page = parseInteger(searchParams.get('page'), 1);
  const rawPageSize = parseInteger(searchParams.get('pageSize'), DEFAULT_PAGE_SIZE);
  const pageSize = Math.min(rawPageSize, MAX_PAGE_SIZE);
  const skip = (page - 1) * pageSize;

  const where: Prisma.BookingWhereInput = {};

  const status = searchParams.get('status');
  if (status) {
    where.status = status as BookingStatus;
  }

  const type = searchParams.get('type');
  if (type) {
    where.type = type as BookingType;
  }

  const fromDate = parseDate(searchParams.get('from'));
  const toDate = parseDate(searchParams.get('to'));
  const dateFilter: Prisma.DateTimeFilter = {};
  if (fromDate) {
    dateFilter.gte = fromDate;
  }
  if (toDate) {
    const endOfDay = new Date(toDate);
    endOfDay.setHours(23, 59, 59, 999);
    dateFilter.lte = endOfDay;
  }
  if (Object.keys(dateFilter).length > 0) {
    where.date = dateFilter;
  }

  const query = searchParams.get('q');
  if (query) {
    const normalized = query.trim();
    if (normalized.length > 0) {
      where.OR = [
        { name: { contains: normalized } },
        { email: { contains: normalized } },
        { phone: { contains: normalized } },
      ];
    }
  }

  return { page, pageSize, skip, where };
}

export const ADMIN_BOOKINGS_DEFAULT_PAGE_SIZE = DEFAULT_PAGE_SIZE;
export const ADMIN_BOOKINGS_MAX_PAGE_SIZE = MAX_PAGE_SIZE;
