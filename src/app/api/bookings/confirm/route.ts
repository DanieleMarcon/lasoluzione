import { NextResponse } from 'next/server';
import { Prisma, type Order } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { logger } from '@/lib/logger';
import { formatEventSchedule } from '@/lib/date';
import { sendBookingConfirmedAdmin, sendBookingConfirmedCustomer } from '@/lib/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

type CartWithItems = {
  id: string;
  items: CartItemRow[];
};

type BookingWithOrder = Prisma.BookingGetPayload<{
  include: {
    order: {
      include: {
        cart: {
          include: {
            items: true;
          };
        };
      };
    };
  };
}>;

type VerifyErrorCode =
  | 'token_missing'
  | 'token_invalid'
  | 'token_expired'
  | 'order_not_found'
  | 'email_mismatch'
  | 'config_error';

type RedirectContext = {
  bookingId?: string | null;
  cartId?: string | null;
  email?: string | null;
};

type BookingTokenTransactionResult =
  | { status: 'ok'; booking: BookingWithOrder; sendEmails: boolean }
  | { status: 'invalid'; bookingId?: number | null }
  | { status: 'expired'; bookingId?: number | null };

function resolveBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.APP_BASE_URL ??
    process.env.BASE_URL ??
    'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

function redirectToVerifyError(code: VerifyErrorCode, context: RedirectContext = {}) {
  const baseUrl = resolveBaseUrl();
  const params = new URLSearchParams({ error: code });
  if (context.bookingId) {
    params.append('bookingId', context.bookingId);
  }
  const redirectUrl = `${baseUrl}/checkout/email-sent?${params.toString()}`;
  logger.warn('booking.verify.invalid', {
    action: 'booking.verify',
    outcome: 'invalid',
    reason: code,
    cartId: context.cartId ?? null,
    email: context.email ?? null,
    bookingId: context.bookingId ?? null,
  });
  const response = NextResponse.redirect(redirectUrl, { status: 302 });
  response.headers.set('x-redirect-to', redirectUrl);
  return setDebugHeaders(response, 'app/api/bookings/confirm/route.ts');
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

type EmailOnlyFlagEvaluation = {
  flagFound: boolean;
  emailOnly: boolean;
};

function normalizeEmailOnlyValue(value: unknown): boolean | null {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (!normalized) return null;
    if (['true', '1', 'yes', 'y', 'si', 'sì'].includes(normalized)) {
      return true;
    }
    if (['false', '0', 'no', 'n'].includes(normalized)) {
      return false;
    }
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return null;
}

function extractEmailOnlyFromMeta(meta: unknown): EmailOnlyFlagEvaluation {
  if (!meta || typeof meta !== 'object') {
    return { flagFound: false, emailOnly: false };
  }

  const record = meta as Record<string, unknown>;
  const metaType = typeof record.type === 'string' ? record.type : null;
  const hasEmailOnly = Object.prototype.hasOwnProperty.call(record, 'emailOnly');

  if (metaType === 'event' && hasEmailOnly) {
    const normalized = normalizeEmailOnlyValue(record.emailOnly);
    if (normalized === null) {
      return { flagFound: true, emailOnly: false };
    }
    return { flagFound: true, emailOnly: normalized };
  }

  if (!hasEmailOnly) {
    return { flagFound: false, emailOnly: false };
  }

  const normalized = normalizeEmailOnlyValue(record.emailOnly);
  if (normalized === null) {
    return { flagFound: true, emailOnly: false };
  }

  return { flagFound: true, emailOnly: normalized };
}

async function evaluateEmailOnly(cart: CartWithItems): Promise<EmailOnlyFlagEvaluation> {
  if (!cart.items || cart.items.length === 0) {
    return { flagFound: false, emailOnly: false };
  }

  let flaggedItems = 0;
  let allEmailOnly = true;

  for (const item of cart.items) {
    const { flagFound: metaFlagFound, emailOnly: metaEmailOnly } = extractEmailOnlyFromMeta(item.meta ?? undefined);
    if (metaFlagFound) {
      flaggedItems += 1;
      if (!metaEmailOnly) {
        allEmailOnly = false;
      }
    } else {
      allEmailOnly = false;
    }
  }

  if (flaggedItems > 0) {
    const allFlagged = flaggedItems === cart.items.length;
    return { flagFound: true, emailOnly: allFlagged && allEmailOnly };
  }

  const productIds = Array.from(
    new Set(
      cart.items
        .map((item) => (typeof item.productId === 'number' ? item.productId : Number.parseInt(String(item.productId), 10)))
        .filter((id) => Number.isFinite(id)) as number[],
    ),
  );

  if (productIds.length === 0) {
    return { flagFound: false, emailOnly: false };
  }

  const instances = await prisma.eventInstance.findMany({
    where: { productId: { in: productIds } },
    select: { allowEmailOnlyBooking: true },
  });

  if (instances.length === 0) {
    return { flagFound: false, emailOnly: false };
  }

  const hasEmailOnlyInstance = instances.some((instance) => instance.allowEmailOnlyBooking);
  if (hasEmailOnlyInstance) {
    return { flagFound: true, emailOnly: true };
  }

  return { flagFound: true, emailOnly: false };
}

function setDebugHeaders(response: NextResponse, handler: string) {
  response.headers.set('x-handler', handler);
  response.headers.set('x-route-phase', 'confirm-handler');
  response.headers.set('Cache-Control', 'no-store');
  return response;
}

async function handleBookingVerificationToken(token: string, bookingIdParam: string | null) {
  const existing = await prisma.bookingVerification.findUnique({ where: { token } });
  if (!existing) {
    return { handled: false as const };
  }

  const txResult = await prisma.$transaction<BookingTokenTransactionResult>(async (tx) => {
    const verification = await tx.bookingVerification.findUnique({
      where: { token },
      include: {
        Booking: {
          include: {
            order: {
              include: {
                cart: {
                  include: {
                    items: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!verification || !verification.Booking) {
      return { status: 'invalid', bookingId: existing.bookingId ?? null };
    }

    const booking = verification.Booking;
    const now = new Date();
    const alreadyConfirmed = booking.status === 'confirmed';

    if (verification.expiresAt <= now && !alreadyConfirmed) {
      return { status: 'expired', bookingId: booking.id };
    }

    if (verification.usedAt && !alreadyConfirmed) {
      return { status: 'invalid', bookingId: booking.id };
    }

    const shouldSendEmails = !alreadyConfirmed;

    if (!verification.usedAt) {
      await tx.bookingVerification.update({
        where: { id: verification.id },
        data: { usedAt: now },
      });
    }

    await tx.bookingVerification.deleteMany({
      where: {
        bookingId: booking.id,
        id: { not: verification.id },
      },
    });

    await tx.booking.update({
      where: { id: booking.id },
      data: {
        status: 'confirmed',
        prepayToken: null,
      },
    });

    if (booking.orderId) {
      try {
        await tx.order.update({
          where: { id: booking.orderId },
          data: {
            status: 'confirmed',
            email: booking.email,
            name: booking.name,
            phone: booking.phone,
            notes: booking.notes ?? null,
          },
        });
      } catch (error) {
        console.error('[bookings][confirm] order update failed', error);
        throw error;
      }

      const relatedOrder = await tx.order.findUnique({
        where: { id: booking.orderId },
        include: { cart: true },
      });

      if (relatedOrder?.cartId) {
        await tx.cart.update({
          where: { id: relatedOrder.cartId },
          data: { status: 'locked' },
        });
      }
    }

    const finalBooking = await tx.booking.findUnique({
      where: { id: booking.id },
      include: {
        order: {
          include: {
            cart: {
              include: {
                items: true,
              },
            },
          },
        },
      },
    });

    if (!finalBooking) {
      return { status: 'invalid', bookingId: booking.id };
    }

    return { status: 'ok', booking: finalBooking, sendEmails: shouldSendEmails };
  });

  if (txResult.status !== 'ok') {
    if (txResult.status === 'expired') {
      const response = redirectToVerifyError('token_expired', {
        bookingId: txResult.bookingId ? String(txResult.bookingId) : bookingIdParam,
      });
      return { handled: true as const, response: setDebugHeaders(response, 'app/api/bookings/confirm/route.ts') };
    }

    const response = redirectToVerifyError('token_invalid', {
      bookingId: txResult.bookingId ? String(txResult.bookingId) : bookingIdParam,
    });
    return { handled: true as const, response: setDebugHeaders(response, 'app/api/bookings/confirm/route.ts') };
  }

  const booking = txResult.booking;
  const cartItems = (booking.order?.cart?.items ?? []) as CartItemRow[];
  const eventInfo = extractEventInfo(cartItems);
  const baseUrl = resolveBaseUrl();
  const whenLabel = formatWhenLabel(eventInfo?.startAt ?? booking.date, eventInfo?.endAt ?? null);
  const eventTitle = eventInfo?.title ?? booking.tierLabel ?? 'La Soluzione';

  if (txResult.sendEmails) {
    try {
      await sendBookingConfirmedCustomer({
        to: booking.email,
        bookingId: booking.id,
        eventTitle,
        whenLabel,
        people: booking.people,
        baseUrl,
      });
    } catch (error) {
      console.error('[bookings][confirm] booking confirmation customer email failed', error);
    }

    try {
      await sendBookingConfirmedAdmin({
        to: process.env.MAIL_TO_BOOKINGS ?? '',
        bookingId: booking.id,
        customerName: booking.name,
        customerEmail: booking.email,
        customerPhone: booking.phone ?? '',
        eventTitle,
        whenLabel,
        people: booking.people,
      });
    } catch (error) {
      console.error('[bookings][confirm] booking confirmation admin email failed', error);
    }
  }

  logger.info('booking.confirm.success', {
    action: 'booking.confirm',
    bookingId: booking.id,
    orderId: booking.orderId ?? null,
    source: 'booking_token',
    cartLocked: booking.order?.cart?.status === 'locked',
  });

  const params = new URLSearchParams({ bookingId: String(booking.id) });
  if (booking.orderId) {
    params.append('orderId', booking.orderId);
  }
  const successUrl = `${baseUrl}/checkout/success?${params.toString()}`;

  const response = NextResponse.redirect(successUrl);
  response.headers.set('x-redirect-to', successUrl);
  return { handled: true as const, response: setDebugHeaders(response, 'app/api/bookings/confirm/route.ts') };
}

async function handleLegacyOrderVerification(
  _request: Request,
  token: string,
  bookingIdParam: string | null,
): Promise<NextResponse> {
  let cartId: string | null = null;
  let emailFromToken: string | null = null;

  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) {
    console.error('[bookings][confirm] missing NEXTAUTH_SECRET');
    return redirectToVerifyError('config_error', { bookingId: bookingIdParam });
  }

  const verification = verifyJwt<OrderVerifyTokenPayload>(token, secret);
  if (!verification.valid) {
    const reason = verification.reason === 'expired' ? 'token_expired' : 'token_invalid';
    return redirectToVerifyError(reason, { bookingId: bookingIdParam });
  }

  const payload = verification.payload || ({} as OrderVerifyTokenPayload);
  cartId = typeof payload.cartId === 'string' ? payload.cartId : null;
  emailFromToken = typeof payload.email === 'string' ? payload.email : null;

  if (!cartId || !emailFromToken) {
    return redirectToVerifyError('token_invalid', { bookingId: bookingIdParam });
  }

  const order = await prisma.order.findUnique({ where: { cartId } });

  if (!order) {
    return redirectToVerifyError('order_not_found', {
      bookingId: bookingIdParam,
      cartId,
      email: emailFromToken,
    });
  }

  const emailMatches = order.email?.toLowerCase() === emailFromToken.toLowerCase();
  if (!emailMatches) {
    return redirectToVerifyError('email_mismatch', {
      bookingId: bookingIdParam,
      cartId,
      email: emailFromToken,
    });
  }

  const cart = await prisma.cart.findUnique({
    where: { id: order.cartId },
    include: { items: true },
  });

  const cartItems = cart?.items ? (cart.items as CartItemRow[]) : [];
  let emailOnlyFlagFound = false;
  let emailOnly = false;

  if (cart && cartItems.length) {
    const evaluation = await evaluateEmailOnly({ id: cart.id, items: cartItems });
    emailOnlyFlagFound = evaluation.flagFound;
    emailOnly = evaluation.emailOnly;
  }

  if (!emailOnlyFlagFound) {
    const fallbackTotal = cart?.totalCents ?? order.totalCents ?? 0;
    emailOnly = fallbackTotal <= 0;
  }

  logger.info('order.verify.email_only_evaluation', {
    cartId: order.cartId,
    orderId: order.id,
    emailOnly,
  });

  if (emailOnly) {
    return handleLegacyEmailOnlyConfirmation(order, cart, cartItems, payload);
  }

  const baseUrl = resolveBaseUrl();
  const redirectUrl = `${baseUrl}/checkout?verified=1`;

  const response = NextResponse.redirect(redirectUrl);
  response.headers.set('x-redirect-to', redirectUrl);
  response.cookies.set({
    name: VERIFY_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: VERIFY_TOKEN_TTL_SECONDS,
    path: '/',
  });

  logger.info('order.verify.ok', { orderId: order.id, email: order.email, emailOnly: false });

  return setDebugHeaders(response, 'app/api/bookings/confirm/route.ts');
}

async function handleLegacyEmailOnlyConfirmation(
  order: Order,
  cart: Prisma.CartGetPayload<{ include: { items: true } }> | null,
  cartItems: CartItemRow[],
  payload: OrderVerifyTokenPayload,
): Promise<NextResponse> {
  let bookingId: number | null = null;

  if (!cart || cartItems.length === 0) {
    console.error('[bookings][confirm] cart not found or empty during email-only confirmation', {
      orderId: order.id,
      cartId: order.cartId,
    });
  } else if (order.status !== 'confirmed') {
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
      console.error('[bookings][confirm] booking confirmation customer email failed', error);
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
      console.error('[bookings][confirm] booking confirmation admin email failed', error);
    }
  } else {
    const existingConfirmedBooking = await prisma.booking.findFirst({
      where: { orderId: order.id },
      orderBy: { id: 'desc' },
    });
    bookingId = existingConfirmedBooking?.id ?? null;
  }

  const baseUrl = resolveBaseUrl();
  const params = new URLSearchParams({ orderId: order.id });
  if (bookingId) {
    params.append('bookingId', String(bookingId));
  }
  const successUrl = `${baseUrl}/checkout/success?${params.toString()}`;

  const response = NextResponse.redirect(successUrl);
  response.headers.set('x-redirect-to', successUrl);
  response.cookies.delete(VERIFY_COOKIE);

  logger.info('order.confirmed.email_only', { orderId: order.id, bookingId, email: order.email });
  logger.info('order.verify.ok', { orderId: order.id, email: order.email, emailOnly: true });

  return setDebugHeaders(response, 'app/api/bookings/confirm/route.ts');
}

export async function GET(request: Request) {
  let bookingIdParam: string | null = null;
  try {
    const url = new URL(request.url);
    bookingIdParam = url.searchParams.get('bookingId');
    const token = url.searchParams.get('token');

    if (!token) {
      const response = redirectToVerifyError('token_missing', { bookingId: bookingIdParam });
      return setDebugHeaders(response, 'app/api/bookings/confirm/route.ts');
    }

    const bookingTokenResult = await handleBookingVerificationToken(token, bookingIdParam);
    if (bookingTokenResult.handled) {
      return bookingTokenResult.response;
    }

    const legacyResponse = await handleLegacyOrderVerification(request, token, bookingIdParam);
    return setDebugHeaders(legacyResponse, 'app/api/bookings/confirm/route.ts');
  } catch (error) {
    console.error('[bookings][confirm] error', error);
    const response = redirectToVerifyError('token_invalid', { bookingId: bookingIdParam });
    return setDebugHeaders(response, 'app/api/bookings/confirm/route.ts');
  }
}

export async function POST(request: Request) {
  return GET(request);
}
