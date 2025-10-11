import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

import { prisma } from '@/lib/prisma';
import { verifyJwt } from '@/lib/jwt';
import { logger } from '@/lib/logger';
import { formatEventSchedule } from '@/lib/date';
import {
  sendBookingConfirmationToCustomer,
  sendBookingNotificationToAdmin,
} from '@/lib/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

type OrderWithCart = Prisma.OrderGetPayload<{
  include: {
    cart: {
      include: {
        items: true;
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

const DEFAULT_BOOKING_ADMIN_EMAIL = 'info@lasoluzione.eu';
// TODO: validate BOOKING_ADMIN_EMAIL via a centralized env schema.
const BOOKING_ADMIN_EMAIL =
  process.env.BOOKING_ADMIN_EMAIL ??
  process.env.MAIL_TO_BOOKINGS ??
  DEFAULT_BOOKING_ADMIN_EMAIL;

function redirectToVerifyError(code: VerifyErrorCode, context: RedirectContext = {}) {
  const baseUrl = resolveBaseUrl();
  const params = new URLSearchParams({ error: code });
  if (context.bookingId) {
    params.append('bookingId', context.bookingId);
  }
  const bookingIdForLog =
    typeof context.bookingId === 'string'
      ? Number.parseInt(context.bookingId, 10)
      : context.bookingId ?? null;
  const bookingIdLog =
    typeof bookingIdForLog === 'number' && Number.isFinite(bookingIdForLog)
      ? bookingIdForLog
      : null;
  const redirectUrl = `${baseUrl}/checkout/email-sent?${params.toString()}`;
  logger.warn('booking.verify.invalid', {
    action: 'booking.verify',
    outcome: 'invalid',
    reason: code,
    cartId: context.cartId ?? null,
    email: context.email ?? null,
    bookingId: bookingIdLog,
  });
  const response = NextResponse.redirect(redirectUrl, { status: 302 });
  response.headers.set('x-redirect-to', redirectUrl);
  return setDebugHeaders(response, 'app/api/bookings/confirm/route.ts');
}

function buildSuccessRedirect(params: { bookingId?: number | null; orderId?: string | null }) {
  const baseUrl = resolveBaseUrl();
  const searchParams = new URLSearchParams();
  if (params.orderId) {
    searchParams.append('orderId', params.orderId);
  }
  if (params.bookingId) {
    searchParams.append('bookingId', String(params.bookingId));
  }
  const query = searchParams.toString();
  const successUrl =
    query ? `${baseUrl}/checkout/success?${query}` : `${baseUrl}/checkout/success`;
  const response = NextResponse.redirect(successUrl, { status: 303 });
  response.headers.set('x-redirect-to', successUrl);
  response.headers.set('x-handler', 'app/api/bookings/confirm/route.ts');
  response.headers.set('x-route-phase', 'confirm-handler');
  response.headers.set('Cache-Control', 'no-store');
  return response;
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

function resolveBookingEmailContext(booking: BookingWithOrder) {
  const cartItems = (booking.order?.cart?.items ?? []) as CartItemRow[];
  const eventInfo = extractEventInfo(cartItems);
  const fallbackItem = cartItems[0];
  const eventTitle =
    eventInfo?.title ??
    booking.tierLabel ??
    (typeof fallbackItem?.nameSnapshot === 'string' && fallbackItem.nameSnapshot.trim()
      ? fallbackItem.nameSnapshot
      : 'La Soluzione');
  const whenLabel = formatWhenLabel(eventInfo?.startAt ?? booking.date, eventInfo?.endAt ?? null);
  const peopleFromBooking = Number.isFinite(booking.people) ? booking.people : 0;
  const derivedPeople =
    peopleFromBooking && peopleFromBooking > 0 ? peopleFromBooking : sumPeople(cartItems);

  return {
    eventTitle,
    whenLabel,
    people: derivedPeople > 0 ? derivedPeople : 1,
    customerName: booking.name?.trim() ? booking.name : undefined,
    customerEmail: booking.email,
    customerPhone: booking.phone?.trim() ? booking.phone : undefined,
  };
}

function buildBookingCreateInputFromOrder({
  order,
  cartItems,
  payload,
}: {
  order: OrderWithCart;
  cartItems: CartItemRow[];
  payload: OrderVerifyTokenPayload;
}): Prisma.BookingCreateInput {
  const mappedItems = mapItems(cartItems);
  const people = sumPeople(cartItems);
  const eventInfo = extractEventInfo(cartItems);
  const primaryItem = cartItems[0];
  const bookingDate = eventInfo?.startAt ?? new Date();
  const bookingType = eventInfo ? 'evento' : 'pranzo';
  const tierLabel =
    eventInfo?.title ??
    (typeof primaryItem?.nameSnapshot === 'string' && primaryItem.nameSnapshot.trim()
      ? primaryItem.nameSnapshot
      : 'La Soluzione');
  const tierPriceCents = primaryItem?.priceCentsSnapshot ?? null;

  return {
    date: bookingDate,
    people,
    name: order.name,
    email: order.email,
    phone: order.phone ?? '',
    notes: order.notes ?? null,
    agreePrivacy: true,
    agreeMarketing: payload.agreeMarketing === true,
    status: 'confirmed',
    type: bookingType as any,
    order: { connect: { id: order.id } },
    lunchItemsJson: mappedItems as unknown as Prisma.InputJsonValue,
    subtotalCents: order.totalCents,
    totalCents: order.totalCents,
    tierLabel,
    tierPriceCents,
    prepayToken: null,
  };
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

    logger.info('booking.confirm.start', {
      action: 'booking.confirm',
      bookingId: booking.id,
      orderId: booking.orderId ?? null,
      source: 'booking_token',
      cartId: booking.order?.cartId ?? booking.order?.cart?.id ?? null,
    });

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

    if (booking.order) {
      const orderUpdateData: Prisma.OrderUpdateInput = {
        status: 'confirmed',
      };

      if (booking.email?.trim()) {
        orderUpdateData.email = booking.email;
      }

      if (booking.name?.trim()) {
        orderUpdateData.name = booking.name;
      }

      if (booking.phone?.trim()) {
        orderUpdateData.phone = booking.phone;
      } else if (booking.order.phone === null) {
        orderUpdateData.phone = null;
      }

      if (typeof booking.notes === 'string') {
        orderUpdateData.notes = booking.notes;
      } else if (booking.notes === null) {
        orderUpdateData.notes = null;
      }

      await tx.order.update({
        where: { id: booking.order.id },
        data: orderUpdateData,
      });

      if (booking.order.cartId) {
        await tx.cart.update({
          where: { id: booking.order.cartId },
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
      return {
        handled: true as const,
        response: setDebugHeaders(response, 'app/api/bookings/confirm/route.ts'),
      };
    }

    const response = redirectToVerifyError('token_invalid', {
      bookingId: txResult.bookingId ? String(txResult.bookingId) : bookingIdParam,
    });
    return {
      handled: true as const,
      response: setDebugHeaders(response, 'app/api/bookings/confirm/route.ts'),
    };
  }

  const booking = txResult.booking;
  const { eventTitle, whenLabel, people, customerName, customerEmail, customerPhone } =
    resolveBookingEmailContext(booking);

  if (txResult.sendEmails) {
    const baseUrl = resolveBaseUrl();
    let customerEmailSent = false;
    let adminEmailSent = false;

    try {
      await sendBookingConfirmationToCustomer({
        bookingId: booking.id,
        orderId: booking.orderId ?? undefined,
        customerName,
        customerEmail,
        customerPhone,
        people,
        eventTitle,
        whenLabel,
        baseUrl,
      });
      customerEmailSent = true;
    } catch (error) {
      console.error('[bookings][confirm] booking confirmation customer email failed', error);
    }

    try {
      await sendBookingNotificationToAdmin({
        bookingId: booking.id,
        orderId: booking.orderId ?? undefined,
        adminEmail: BOOKING_ADMIN_EMAIL,
        customerName,
        customerEmail,
        customerPhone,
        people,
        eventTitle,
        whenLabel,
      });
      adminEmailSent = true;
    } catch (error) {
      console.error('[bookings][confirm] booking confirmation admin email failed', error);
    }

    if (customerEmailSent || adminEmailSent) {
      logger.info('booking.confirm.emails_sent', {
        bookingId: booking.id,
        orderId: booking.orderId ?? null,
        email: booking.email,
      });
    }
  }

  logger.info('booking.confirm.success', {
    action: 'booking.confirm',
    bookingId: booking.id,
    orderId: booking.orderId ?? null,
    source: 'booking_token',
    cartLocked: booking.order?.cart?.status === 'locked',
  });

  const response = buildSuccessRedirect({
    bookingId: booking.id,
    orderId: booking.orderId ?? null,
  });
  return { handled: true as const, response };
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

  const order = await prisma.order.findUnique({
    where: { cartId },
    include: {
      cart: { include: { items: true } },
      bookings: { orderBy: { id: 'desc' } },
    },
  });

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

  const cart = order.cart ?? null;
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

  const txResult = await prisma.$transaction(async (tx) => {
    const currentOrder = await tx.order.findUnique({
      where: { id: order.id },
      include: {
        cart: { include: { items: true } },
      },
    });

    if (!currentOrder) {
      return { status: 'order_missing' as const };
    }

    const currentCartItems = (currentOrder.cart?.items ?? []) as CartItemRow[];

    let bookingRecord = await tx.booking.findFirst({
      where: { orderId: currentOrder.id },
      orderBy: { id: 'desc' },
      include: {
        order: {
          include: {
            cart: { include: { items: true } },
          },
        },
      },
    });

    let shouldSendEmails = false;

    if (!bookingRecord) {
      const createInput = buildBookingCreateInputFromOrder({
        order: currentOrder,
        cartItems: currentCartItems.length ? currentCartItems : cartItems,
        payload,
      });

      bookingRecord = await tx.booking.create({
        data: createInput,
        include: {
          order: {
            include: {
              cart: { include: { items: true } },
            },
          },
        },
      });
      await tx.bookingVerification.deleteMany({ where: { bookingId: bookingRecord.id } });
      shouldSendEmails = true;
    } else {
      if (bookingRecord.status !== 'confirmed' || bookingRecord.prepayToken) {
        await tx.booking.update({
          where: { id: bookingRecord.id },
          data: { status: 'confirmed', prepayToken: null },
        });
        shouldSendEmails = bookingRecord.status !== 'confirmed';
      }

      await tx.bookingVerification.deleteMany({ where: { bookingId: bookingRecord.id } });

      bookingRecord = (await tx.booking.findUnique({
        where: { id: bookingRecord.id },
        include: {
          order: {
            include: {
              cart: { include: { items: true } },
            },
          },
        },
      })) as BookingWithOrder | null;
    }

    await tx.order.update({
      where: { id: currentOrder.id },
      data: {
        status: 'confirmed',
        email: currentOrder.email,
        name: currentOrder.name,
        phone: currentOrder.phone,
        notes: currentOrder.notes ?? null,
      },
    });

    if (currentOrder.cartId) {
      await tx.cart.update({
        where: { id: currentOrder.cartId },
        data: { status: 'locked' },
      });
    }

    return {
      status: 'ok' as const,
      booking: bookingRecord,
      shouldSendEmails,
    };
  });

  if (txResult.status !== 'ok') {
    return redirectToVerifyError('order_not_found', {
      bookingId: bookingIdParam,
      cartId,
      email: emailFromToken,
    });
  }

  const booking = txResult.booking;

  if (booking) {
    logger.info('booking.confirm.start', {
      action: 'booking.confirm',
      bookingId: booking.id,
      orderId: booking.orderId ?? null,
      source: 'legacy_token',
      cartId: booking.order?.cartId ?? booking.order?.cart?.id ?? null,
    });
  }

  if (txResult.shouldSendEmails && booking) {
    const { eventTitle, whenLabel, people, customerName, customerEmail, customerPhone } =
      resolveBookingEmailContext(booking);
    const baseUrl = resolveBaseUrl();
    let customerEmailSent = false;
    let adminEmailSent = false;

    try {
      await sendBookingConfirmationToCustomer({
        bookingId: booking.id,
        orderId: booking.orderId ?? undefined,
        customerName,
        customerEmail,
        customerPhone,
        people,
        eventTitle,
        whenLabel,
        baseUrl,
      });
      customerEmailSent = true;
    } catch (error) {
      console.error('[bookings][confirm] booking confirmation customer email failed', error);
    }

    try {
      await sendBookingNotificationToAdmin({
        bookingId: booking.id,
        orderId: booking.orderId ?? undefined,
        adminEmail: BOOKING_ADMIN_EMAIL,
        customerName,
        customerEmail,
        customerPhone,
        people,
        eventTitle,
        whenLabel,
      });
      adminEmailSent = true;
    } catch (error) {
      console.error('[bookings][confirm] booking confirmation admin email failed', error);
    }

    if (customerEmailSent || adminEmailSent) {
      logger.info('booking.confirm.emails_sent', {
        bookingId: booking.id,
        orderId: booking.orderId ?? null,
        email: booking.email,
      });
    }
  }

  if (booking) {
    logger.info('booking.confirm.success', {
      action: 'booking.confirm',
      bookingId: booking.id,
      orderId: booking.orderId ?? null,
      source: 'legacy_token',
      cartLocked: booking.order?.cart?.status === 'locked',
    });
  }

  if (emailOnly) {
    logger.info('order.confirmed.email_only', {
      orderId: order.id,
      bookingId: booking?.id ?? null,
      email: order.email,
    });
  }

  logger.info('order.verify.ok', { orderId: order.id, email: order.email, emailOnly });

  const response = buildSuccessRedirect({
    bookingId: booking?.id ?? null,
    orderId: order.id,
  });

  return response;
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
