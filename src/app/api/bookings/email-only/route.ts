import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { bookingSchema } from '@/components/booking/validation';
import { issueBookingToken } from '@/lib/bookingVerification';
import { sendBookingVerifyEmail } from '@/lib/mailer';
import { logger } from '@/lib/logger';
import { formatEventSchedule } from '@/lib/date';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE_BOOKING_OBJECT = (bookingSchema as unknown as { _def?: { schema?: z.ZodTypeAny } })._def
  ?.schema as z.ZodObject<any> | undefined;

const nameField = BASE_BOOKING_OBJECT?.shape?.name ?? z.string().trim().min(2, 'Inserisci il tuo nome');
const emailField = BASE_BOOKING_OBJECT?.shape?.email ?? z.string().email('Email non valida');
const phoneField = BASE_BOOKING_OBJECT?.shape?.phone ?? z.string().trim().min(8, 'Inserisci un numero di telefono valido');
const notesField = BASE_BOOKING_OBJECT?.shape?.notes ?? z.string().trim().max(500).optional();
const peopleField = BASE_BOOKING_OBJECT?.shape?.people ?? z.number().int().min(1).max(20);
const agreePrivacyField =
  (BASE_BOOKING_OBJECT?.shape?.agreePrivacy as z.ZodLiteral<true> | undefined) ??
  z.literal(true, {
    errorMap: () => ({ message: 'Il consenso privacy è obbligatorio.' }),
  });
const agreeMarketingField =
  (BASE_BOOKING_OBJECT?.shape?.agreeMarketing as z.ZodTypeAny | undefined) ??
  z.boolean().optional();

const customerSchema = z.object({
  name: nameField,
  email: emailField,
  phone: phoneField,
});

const emailOnlyBookingSchema = z
  .object({
    eventInstanceId: z.number().int().positive().optional(),
    eventSlug: z.string().min(1).optional(),
    customer: customerSchema.optional(),
    name: nameField.optional(),
    email: emailField.optional(),
    phone: phoneField.optional(),
    people: peopleField.optional(),
    notes: notesField.nullish(),
    agreePrivacy: agreePrivacyField,
    agreeMarketing: agreeMarketingField.default(false),
  })
  .superRefine((data, ctx) => {
    if (!data.eventSlug && !data.eventInstanceId) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Specificare un evento tramite slug o ID.',
        path: ['eventSlug'],
      });
    }

    const hasCustomer = Boolean(data.customer);
    const hasTopLevel = Boolean(data.name && data.email && data.phone);

    if (!hasCustomer && !hasTopLevel) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Dati cliente mancanti.',
        path: ['customer'],
      });
    }
  });

function resolveBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_BASE_URL ?? process.env.APP_BASE_URL ?? '';
  return raw.replace(/\/$/, '');
}

function formatWhenLabel(startAt: Date, endAt: Date | null): string {
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

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const parsed = emailOnlyBookingSchema.parse(payload);

    const customer = parsed.customer ?? {
      name: parsed.name!,
      email: parsed.email!,
      phone: parsed.phone!,
    };

    let event = null;

    if (parsed.eventSlug) {
      event = await prisma.eventInstance.findFirst({
        where: { slug: parsed.eventSlug, active: true },
      });

      if (!event) {
        return NextResponse.json(
          { ok: false, error: 'event_slug_not_found', message: 'Evento non trovato o non attivo.' },
          { status: 400 },
        );
      }
    } else {
      event = await prisma.eventInstance.findUnique({
        where: { id: parsed.eventInstanceId! },
      });

      if (event && !event.active) {
        return NextResponse.json(
          {
            ok: false,
            error: 'event_not_active',
            message: 'Evento non trovato o non attivo.',
          },
          { status: 400 },
        );
      }
    }

    if (!event) {
      return NextResponse.json({ ok: false, error: 'event_not_found' }, { status: 404 });
    }

    if (!event.allowEmailOnlyBooking) {
      return NextResponse.json({ ok: false, error: 'email_only_not_allowed' }, { status: 400 });
    }

    const product = event.productId
      ? await prisma.product.findUnique({ where: { id: event.productId } })
      : null;

    const notesValue = typeof parsed.notes === 'string' ? parsed.notes : undefined;
    const peopleValue = parsed.people;

    if (typeof peopleValue !== 'number') {
      return NextResponse.json(
        { ok: false, error: 'invalid_people', message: 'Numero di persone non valido.' },
        { status: 400 },
      );
    }

    const booking = await prisma.booking.create({
      data: {
        date: event.startAt,
        people: peopleValue,
        type: 'evento',
        status: 'pending',
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        notes: notesValue && notesValue.length ? notesValue : null,
        agreePrivacy: parsed.agreePrivacy,
        agreeMarketing: parsed.agreeMarketing,
        prepayToken: null,
        tierType: 'evento',
        tierLabel: event.title ?? null,
        tierPriceCents: product?.priceCents ?? null,
      },
    });

    const verification = await issueBookingToken(booking.id, booking.email);

    const baseUrl = resolveBaseUrl();
    const whenLabel = formatWhenLabel(event.startAt, event.endAt ?? null);

    await sendBookingVerifyEmail({
      to: booking.email,
      bookingId: booking.id,
      token: verification.token,
      eventTitle: event.title ?? 'La Soluzione',
      whenLabel,
      baseUrl,
    });

    logger.info('booking.create', {
      action: 'booking.create',
      bookingId: booking.id,
      eventInstanceId: event.id,
      email: booking.email,
      tokenId: verification.id,
      outcome: 'ok',
    });

    return NextResponse.json({ ok: true, bookingId: booking.id }, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: 'invalid_payload', details: error.flatten() }, { status: 400 });
    }
    logger.error('booking.create', {
      action: 'booking.create',
      outcome: 'error',
      error: error instanceof Error ? error.message : 'unknown_error',
    });
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
