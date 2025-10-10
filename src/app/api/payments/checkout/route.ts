// src/app/api/payments/checkout/route.ts
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { z } from 'zod';

import { recalcCartTotal } from '@/lib/cart';
import { formatEventSchedule } from '@/lib/date';
import { issueBookingToken } from '@/lib/bookingVerification';
import { prisma } from '@/lib/prisma';
import { createRevolutOrder } from '@/lib/revolut';
import {
  sendBookingVerifyEmail,
  sendOrderEmailVerifyLink,
  sendOrderPaymentEmail,
} from '@/lib/mailer';
import { encodeRevolutPaymentMeta, mergeEmailStatus, parsePaymentRef } from '@/lib/paymentRef';
import { signJwt, verifyJwt } from '@/lib/jwt';
import { logger } from '@/lib/logger';

export const dynamic = 'force-dynamic';

const CART_COOKIE = 'cart_token';
const VERIFY_COOKIE = 'order_verify_token';
const VERIFY_TOKEN_TTL_SECONDS = 15 * 60;

const payloadSchema = z.object({
  name: z.string().trim().min(1),
  email: z.string().email(),
  phone: z.string().trim().min(6),
  notes: z.string().trim().max(2000).optional(),
  agreePrivacy: z
    .literal(true, {
      errorMap: () => ({ message: 'Il consenso privacy è obbligatorio.' }),
    })
    .default(true),
  agreeMarketing: z.boolean().optional().default(false),
  verifyToken: z.string().trim().min(1).optional(),
});

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

type OrderVerifyTokenPayload = {
  cartId: string;
  email: string;
  name?: string;
  phone?: string;
  agreePrivacy?: boolean;
  agreeMarketing?: boolean;
  iat: number;
  exp: number;
};

function resolveBaseUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.APP_BASE_URL ??
    process.env.BASE_URL ??
    'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

function buildVerifyLink(token: string): string {
  const base =
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.APP_BASE_URL ??
    process.env.BASE_URL ??
    'http://localhost:3000';
  const normalized = base.replace(/\/$/, '');
  return `${normalized}/api/payments/email-verify?token=${encodeURIComponent(token)}`;
}

function formatWhenLabel(startAt: Date | null, endAt: Date | null): string {
  if (!startAt) return '';
  const label = formatEventSchedule(startAt, endAt ?? undefined);
  if (label.trim().length > 0) return label;
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

function normalizeNotes(notes?: string | null): string | null {
  if (typeof notes !== 'string') return null;
  const trimmed = notes.trim();
  return trimmed.length ? trimmed : null;
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

function getBaseUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_BASE_URL?.replace(/\/$/, '');
  return fromEnv || 'http://localhost:3000';
}

export async function POST(req: Request) {
  try {
    const payload = await req.json().catch(() => ({}));
    const parsed = payloadSchema.safeParse(payload ?? {});
    if (!parsed.success) {
      return NextResponse.json({ ok: false, error: 'invalid_payload' }, { status: 400 });
    }

    const marketingConsentCandidate = (parsed.data.agreeMarketing ?? false) as boolean;

    const jar = cookies();
    const cartId = jar.get(CART_COOKIE)?.value ?? null;
    const cookieToken = jar.get(VERIFY_COOKIE)?.value ?? null;
    if (!cartId) {
      return NextResponse.json({ ok: false, error: 'cart_not_found' }, { status: 404 });
    }

    let cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: { items: true },
    });

    if (!cart || !Array.isArray(cart.items) || cart.items.length === 0) {
      return NextResponse.json({ ok: false, error: 'cart_empty' }, { status: 400 });
    }

    // Auto-riapri se ha item ma status non valido
    if (cart.status !== 'open' && cart.status !== 'locked') {
      await prisma.cart.update({
        where: { id: cart.id },
        data: { status: 'open' },
      });
      cart = await prisma.cart.findUnique({
        where: { id: cart.id },
        include: { items: true },
      });
    }

    const totalCents = await recalcCartTotal(cart.id);
    const orderStatus = totalCents > 0 ? 'pending_payment' : 'pending';

    const normalizedNotes = normalizeNotes(parsed.data.notes ?? null);

    let order = await prisma.order.findUnique({ where: { cartId: cart.id } });

    if (!order) {
      try {
        order = await prisma.order.create({
          data: {
            cartId: cart.id,
            email: parsed.data.email,
            name: parsed.data.name,
            phone: parsed.data.phone,
            notes: normalizedNotes,
            status: orderStatus,
            totalCents,
          },
        });
      } catch (error: any) {
        if (error?.code === 'P2002') {
          order = await prisma.order.findUnique({ where: { cartId: cart.id } });
        } else {
          throw error;
        }
      }
    }

    if (!order) {
      return NextResponse.json({ ok: false, error: 'order_unavailable' }, { status: 500 });
    }

    if (order.status === 'paid' || order.status === 'confirmed') {
      const response = NextResponse.json(
        {
          ok: true,
          state: 'confirmed' as const,
          orderId: order.id,
          status: order.status,
        },
        { status: 200 }
      );
      response.cookies.delete(VERIFY_COOKIE);
      return response;
    }

    order = await prisma.order.update({
      where: { id: order.id },
      data: {
        email: parsed.data.email,
        name: parsed.data.name,
        phone: parsed.data.phone,
        notes: normalizedNotes,
        status: orderStatus,
        totalCents,
      },
    });

    const cartItems = cart.items as CartItemRow[];

    const secret = process.env.NEXTAUTH_SECRET;
    if (!secret) {
      console.error('[payments][checkout] missing NEXTAUTH_SECRET');
      return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 });
    }

    const bodyToken = parsed.data.verifyToken?.trim() || null;
    const candidateToken = bodyToken || cookieToken || null;
    let verifiedPayload: OrderVerifyTokenPayload | null = null;

    // Considera verificato solo se il token coincide col cookie impostato da /email-verify
    if (candidateToken && cookieToken && candidateToken === cookieToken) {
      const verification = verifyJwt<OrderVerifyTokenPayload>(candidateToken, secret);
      if (verification.valid) {
        const v = verification.payload;
        const emailMatches =
          typeof v.email === 'string' &&
          v.email.toLowerCase() === parsed.data.email.toLowerCase();
        if (v.cartId === cart.id && emailMatches && v.agreePrivacy !== false) {
          verifiedPayload = v;
        }
      }
    }

    // Primo passo: invio mail con link di verifica indirizzo
    if (!verifiedPayload) {
      const verifyPayload = {
        cartId: cart.id,
        email: parsed.data.email,
        name: parsed.data.name,
        phone: parsed.data.phone,
        agreePrivacy: true,
        agreeMarketing: marketingConsentCandidate,
      } satisfies Omit<OrderVerifyTokenPayload, 'iat' | 'exp'>;

      const verifyToken = signJwt(verifyPayload, secret, {
        expiresInSeconds: VERIFY_TOKEN_TTL_SECONDS,
      });
      const verifyUrl = buildVerifyLink(verifyToken);

      try {
        await sendOrderEmailVerifyLink({
          to: parsed.data.email,
          name: parsed.data.name,
          verifyUrl,
        });
        logger.info('order.verify_mail.sent', {
          action: 'order.verify_mail.sent',
          email: parsed.data.email,
        });
      } catch (error) {
        console.error('[payments][checkout] verify email send failed', error);
        return NextResponse.json({ ok: false, error: 'verify_email_failed' }, { status: 500 });
      }

      const response = NextResponse.json({
        ok: true,
        state: 'verify_sent' as const,
        verifyToken,
        token: verifyToken, // compat con client che legge "token"
      });
      response.cookies.delete(VERIFY_COOKIE);
      return response;
    }

    // Secondo passo: indirizzo verificato → conferma (0€) o redirect pagamento (>0€)
    const marketingConsent =
      (verifiedPayload?.agreeMarketing ?? marketingConsentCandidate) === true;

    if (totalCents <= 0) {
      // Email-only (gratis): crea/aggiorna booking e invia mail di verifica booking
      const mappedItems = mapItems(cartItems);
      const people = sumPeople(cartItems);
      const eventInfo = extractEventInfo(cartItems);
      const primaryItem = cartItems[0];
      const bookingDate = eventInfo?.startAt ?? new Date();
      const bookingType = eventInfo ? 'evento' : 'pranzo';
      const tierLabel = eventInfo?.title ?? primaryItem?.nameSnapshot ?? 'La Soluzione';
      const tierPriceCents = primaryItem?.priceCentsSnapshot ?? null;

      const bookingData = {
        date: bookingDate,
        people,
        name: parsed.data.name,
        email: parsed.data.email,
        phone: parsed.data.phone,
        notes: normalizedNotes,
        agreePrivacy: true,
        agreeMarketing: marketingConsent,
        status: 'pending' as const,
        type: bookingType as any,
        order: { connect: { id: order.id } },
        lunchItemsJson: mappedItems as any,
        subtotalCents: totalCents,
        totalCents,
        tierLabel,
        tierPriceCents,
        prepayToken: null,
      };

      const existingBooking = await prisma.booking.findFirst({ where: { orderId: order.id } });
      const booking = existingBooking
        ? await prisma.booking.update({
            where: { id: existingBooking.id },
            data: bookingData,
          })
        : await prisma.booking.create({ data: bookingData });

      await prisma.bookingVerification.deleteMany({ where: { bookingId: booking.id } });
      const verification = await issueBookingToken(booking.id, booking.email);

      const baseUrl = resolveBaseUrl();
      const whenLabel = formatWhenLabel(eventInfo?.startAt ?? booking.date, eventInfo?.endAt ?? null);
      const eventTitle = tierLabel ?? 'La Soluzione';

      await sendBookingVerifyEmail({
        to: booking.email,
        bookingId: booking.id,
        token: verification.token,
        eventTitle,
        whenLabel,
        baseUrl,
      });

      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'pending', paymentRef: null },
      });

      const response = NextResponse.json(
        {
          ok: true,
          state: 'confirmed' as const,
          orderId: order.id,
          bookingId: booking.id,
          nextUrl: `/checkout/email-sent?bookingId=${booking.id}`,
        },
        { status: 200 }
      );
      response.cookies.delete(VERIFY_COOKIE);
      return response;
    }

    // Importi > 0: aggiorna consenso sui booking legati e genera ordine Revolut
    await prisma.booking.updateMany({
      where: { orderId: order.id },
      data: {
        agreePrivacy: true,
        agreeMarketing: marketingConsent,
      },
    });

    const publicKey = process.env.NEXT_PUBLIC_REVOLUT_PUBLIC_KEY;
    const configWarning = publicKey
      ? undefined
      : 'NEXT_PUBLIC_REVOLUT_PUBLIC_KEY non configurata: il checkout verrà aperto in una nuova finestra.';
    if (configWarning) {
      console.warn('[payments][checkout] missing public checkout key');
    }

    const base = getBaseUrl();
    const returnUrl = process.env.PAY_RETURN_URL || `${base}/checkout/return`;
    const cancelUrl = process.env.PAY_CANCEL_URL || `${base}/checkout/cancel`;

    const parsedRef = parsePaymentRef(order.paymentRef);
    if (parsedRef.kind === 'revolut' && parsedRef.meta.checkoutPublicId) {
      const response = NextResponse.json({
        ok: true,
        state: 'paid_redirect' as const,
        orderId: order.id,
        amountCents: totalCents,
        paymentRef: parsedRef.meta.orderId,
        checkoutPublicId: parsedRef.meta.checkoutPublicId,
        hostedPaymentUrl: parsedRef.meta.hostedPaymentUrl,
        url: parsedRef.meta.hostedPaymentUrl,
        email: parsedRef.meta.emailError ? { ok: false, error: parsedRef.meta.emailError } : { ok: true },
        configWarning,
      });
      response.cookies.delete(VERIFY_COOKIE);
      return response;
    }

    const description = `Prenotazione #${order.id} - Bar La Soluzione`;
    const revolutOrder = await createRevolutOrder({
      amountMinor: totalCents,
      currency: 'EUR',
      merchantOrderId: order.id,
      customer: { email: order.email, name: order.name },
      description,
      captureMode: 'automatic',
      returnUrl,
      cancelUrl,
    } as any);

    const baseMeta = {
      provider: 'revolut' as const,
      orderId: revolutOrder.paymentRef,
      checkoutPublicId: revolutOrder.checkoutPublicId,
      hostedPaymentUrl: revolutOrder.hostedPaymentUrl,
    };

    const emailResult = await sendOrderPaymentEmail({
      to: order.email,
      orderId: order.id,
      amountCents: totalCents,
      hostedPaymentUrl: baseMeta.hostedPaymentUrl,
    });

    if (!emailResult.ok) {
      console.warn('[payments][checkout] invio email non riuscito', emailResult.error || 'unknown_error');
    }

    const finalMeta = mergeEmailStatus(baseMeta, emailResult);

    await prisma.order.update({
      where: { id: order.id },
      data: {
        status: 'pending_payment',
        paymentRef: encodeRevolutPaymentMeta(finalMeta),
      },
    });

    const response = NextResponse.json({
      ok: true,
      state: 'paid_redirect' as const,
      orderId: order.id,
      amountCents: totalCents,
      paymentRef: revolutOrder.paymentRef,
      checkoutPublicId: revolutOrder.checkoutPublicId,
      hostedPaymentUrl: finalMeta.hostedPaymentUrl,
      url: finalMeta.hostedPaymentUrl,
      email: emailResult,
      configWarning,
    });
    response.cookies.delete(VERIFY_COOKIE);
    return response;
  } catch (err) {
    console.error('[payments][checkout] error', err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
