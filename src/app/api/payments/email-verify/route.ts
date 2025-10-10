import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { logger } from '@/lib/logger';
import { formatEventSchedule } from '@/lib/date';
import { sendBookingConfirmedAdmin, sendBookingConfirmedCustomer } from '@/lib/mailer';

const VERIFY_COOKIE = 'order_verify_token';
const VERIFY_TOKEN_TTL_SECONDS = 15 * 60;

type OrderVerifyTokenPayload = {
  cartId: string;
  email: string;
  name?: string;
  phone?: string;
  agreePrivacy?: boolean;
  agreeMarketing?: boolean;
  iat?: number;
  exp?: number;
};

type CartItemRow = {
  productId: number;
  nameSnapshot: string;
  priceCentsSnapshot: number;
  qty: number;
  meta: unknown | null;
};

type EventInfo = {
  title?: string;
  startAt?: Date | null;
  endAt?: Date | null;
};

function resolveBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.APP_BASE_URL ??
    process.env.BASE_URL ??
    'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

function formatWhenLabel(startAt: Date | null, endAt: Date | null): string {
  if (!startAt) return '';
  const label = formatEventSchedule(startAt, endAt ?? undefined);
  if (label.trim().length > 0) {
    return label;
  }

  try {
    return startAt.toLocaleString('it-IT', {
      weekday: 'long',
      day: '2-digit',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function toDate(value: unknown): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function parseEventCandidate(candidate: Record<string, unknown>): EventInfo | null {
  const titleSources = ['title', 'name', 'label'];
  let title: string | undefined;

  for (const key of titleSources) {
    const raw = candidate[key];
    if (typeof raw === 'string' && raw.trim().length) {
      title = raw.trim();
      break;
    }
  }

  const startAt =
    toDate(candidate.startAt) ??
    toDate((candidate as any).start_at) ??
    toDate((candidate as any).start) ??
    toDate(candidate.date) ??
    toDate((candidate as any).startDate);

  const endAt =
    toDate(candidate.endAt) ??
    toDate((candidate as any).end_at) ??
    toDate((candidate as any).end) ??
    toDate((candidate as any).endDate);

  if (!title && !startAt && !endAt) {
    return null;
  }

  return { title, startAt: startAt ?? null, endAt: endAt ?? null };
}

function extractEventInfoFromMeta(meta: unknown): EventInfo | null {
  if (!meta || typeof meta !== 'object') return null;

  const queue: unknown[] = [meta];
  const seen = new Set<object>();

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;
    if (seen.has(current as object)) continue;
    seen.add(current as object);

    const candidate = parseEventCandidate(current as Record<string, unknown>);
    if (candidate) {
      return candidate;
    }

    for (const value of Object.values(current)) {
      if (!value) continue;
      if (Array.isArray(value)) {
        for (const entry of value) {
          queue.push(entry);
        }
      } else if (typeof value === 'object') {
        queue.push(value);
      }
    }
  }

  return null;
}

function extractEventInfo(items: CartItemRow[]): EventInfo | null {
  for (const item of items) {
    const info = extractEventInfoFromMeta(item.meta ?? undefined);
    if (info) {
      if (!info.title && item.nameSnapshot) {
        info.title = item.nameSnapshot;
      }
      return info;
    }
  }
  return null;
}

function mapItems(items: CartItemRow[]) {
  return items.map((item) => ({
    productId: item.productId,
    name: item.nameSnapshot,
    priceCents: item.priceCentsSnapshot,
    qty: item.qty,
    totalCents: item.priceCentsSnapshot * item.qty,
  }));
}

function sumPeople(items: CartItemRow[]): number {
  const total = items.reduce((acc, item) => acc + (Number.isFinite(item.qty) ? item.qty : 0), 0);
  return total > 0 ? total : 1;
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const token = url.searchParams.get('token');

    if (!token) {
      return new NextResponse('Token non valido o scaduto', { status: 400 });
    }

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error('[payments][email-verify] missing NEXTAUTH_SECRET');
      return new NextResponse('Token non valido o scaduto', { status: 400 });
    }

    const verification = verifyJwt<OrderVerifyTokenPayload>(token, secret);
    if (!verification.valid) {
      return new NextResponse('Token non valido o scaduto', { status: 400 });
    }

    const payload = verification.payload || ({} as OrderVerifyTokenPayload);
    const cartId = typeof payload.cartId === 'string' ? payload.cartId : null;
    const email = typeof payload.email === 'string' ? payload.email : null;

    if (!cartId || !email) {
      return new NextResponse('Token non valido o scaduto', { status: 400 });
    }

    const order = await prisma.order.findUnique({ where: { cartId } });

    if (!order) {
      return new NextResponse('Token non valido o scaduto', { status: 400 });
    }

    const emailMatches = order.email?.toLowerCase() === email.toLowerCase();
    if (!emailMatches) {
      return new NextResponse('Token non valido o scaduto', { status: 400 });
    }

    let bookingId: number | null = null;

    if (order.totalCents <= 0 && order.status !== 'confirmed') {
      const cart = await prisma.cart.findUnique({
        where: { id: order.cartId },
        include: { items: true },
      });

      if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
        console.error('[payments][email-verify] cart not found or empty during confirmation', {
          orderId: order.id,
          cartId: order.cartId,
        });
      } else {
        const cartItems = cart.items as CartItemRow[];
        const mappedItems = mapItems(cartItems);
        const people = sumPeople(cartItems);
        const eventInfo = extractEventInfo(cartItems);
        const primaryItem = cartItems[0];
        const bookingDate = eventInfo?.startAt ?? new Date();
        const bookingType = eventInfo ? 'evento' : 'pranzo';
        const tierLabel = eventInfo?.title ?? primaryItem?.nameSnapshot ?? 'La Soluzione';
        const tierPriceCents = primaryItem?.priceCentsSnapshot ?? null;
        const marketingConsent = payload.agreeMarketing === true;

        const bookingData = {
          date: bookingDate,
          people,
          name: order.name,
          email: order.email,
          phone: order.phone ?? '',
          notes: order.notes ?? null,
          agreePrivacy: true,
          agreeMarketing: marketingConsent,
          status: 'confirmed' as const,
          type: bookingType as any,
          order: { connect: { id: order.id } },
          lunchItemsJson: mappedItems as any,
          subtotalCents: order.totalCents,
          totalCents: order.totalCents,
          tierLabel,
          tierPriceCents,
          prepayToken: null,
        };

        const result = await prisma.$transaction(async (tx) => {
          const existingBooking = await tx.booking.findFirst({ where: { orderId: order.id } });

          const savedBooking = existingBooking
            ? await tx.booking.update({
                where: { id: existingBooking.id },
                data: bookingData,
              })
            : await tx.booking.create({ data: bookingData });

          await tx.bookingVerification.deleteMany({ where: { bookingId: savedBooking.id } });

          await tx.order.update({
            where: { id: order.id },
            data: {
              status: 'confirmed',
              email: order.email,
              name: order.name,
              phone: order.phone,
              notes: order.notes ?? null,
            },
          });

          await tx.cart.update({
            where: { id: cart.id },
            data: { status: 'locked' },
          });

          return savedBooking;
        });

        bookingId = result.id;

        const baseUrl = resolveBaseUrl();
        const whenLabel = formatWhenLabel(eventInfo?.startAt ?? null, eventInfo?.endAt ?? null);
        const eventTitle = tierLabel ?? 'La Soluzione';

        try {
          await sendBookingConfirmedCustomer({
            to: order.email,
            bookingId: result.id,
            eventTitle,
            whenLabel,
            people,
            baseUrl,
          });
        } catch (error) {
          console.error('[payments][email-verify] booking confirmation customer email failed', error);
        }

        try {
          await sendBookingConfirmedAdmin({
            to: process.env.MAIL_TO_BOOKINGS ?? '',
            bookingId: result.id,
            customerName: order.name,
            customerEmail: order.email,
            customerPhone: order.phone ?? '',
            eventTitle,
            whenLabel,
            people,
          });
        } catch (error) {
          console.error('[payments][email-verify] booking confirmation admin email failed', error);
        }

        logger.info('order.confirmed.email_only', {
          action: 'order.confirmed.email_only',
          orderId: order.id,
          bookingId: result.id,
          email: order.email,
        });
      }
    } else if (order.totalCents <= 0) {
      const existingConfirmedBooking = await prisma.booking.findFirst({
        where: { orderId: order.id },
        orderBy: { id: 'desc' },
      });
      bookingId = existingConfirmedBooking?.id ?? null;
    }

    const baseUrl = resolveBaseUrl();
    const redirectUrl = `${baseUrl}/checkout?verified=1`;

    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set({
      name: VERIFY_COOKIE,
      value: token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: VERIFY_TOKEN_TTL_SECONDS,
      path: '/',
    });

    logger.info('order.verify.ok', {
      action: 'order.verify.ok',
      email,
      orderId: order.id,
      bookingId,
    });

    return response;
  } catch (error) {
    console.error('[payments][email-verify] error', error);
    return new NextResponse('Token non valido o scaduto', { status: 400 });
  }
}
