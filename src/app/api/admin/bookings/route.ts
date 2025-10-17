// src/app/api/admin/bookings/route.ts
import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { assertAdmin } from '@/lib/admin/session';
import { toAdminBookingDTO } from '@/lib/admin/booking-dto';
import { buildAdminBookingQuery } from '@/lib/admin/booking-query';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  await assertAdmin();

  const { searchParams } = new URL(req.url);

  const { page, pageSize, skip, where } = buildAdminBookingQuery(searchParams);

  const [items, total] = await Promise.all([
    prisma.booking.findMany({
      where,
      orderBy: { date: 'desc' },
      skip,
      take: pageSize,
      include: {
        order: {
          include: {
            cart: { include: { items: true } },
          },
        },
      },
    }),
    prisma.booking.count({ where }),
  ]);

  const data = items.map(toAdminBookingDTO);
  const totalPages = Math.ceil(total / pageSize) || 1;

  return NextResponse.json({
    data,
    meta: {
      page,
      pageSize,
      total,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  });
}
