import { NextResponse } from 'next/server';
import { z } from 'zod';

import { prisma } from '@/lib/prisma';
import { bookingSchema } from '@/components/booking/validation';
import { issueBookingToken } from '@/lib/bookingVerification';
import {
  sendBookingPendingNotificationEmail,
  sendBookingRequestConfirmationEmail,
} from '@/lib/mailer';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BASE_BOOKING_OBJECT = (bookingSchema as unknown as { _def?: { schema?: z.ZodTypeAny } })._def
  ?.schema as z.ZodObject<any> | undefined;

const nameField = BASE_BOOKING_OBJECT?.shape?.name ?? z.string().trim().min(2, 'Inserisci il tuo nome');
const emailField = BASE_BOOKING_OBJECT?.shape?.email ?? z.string().email('Email non valida');
const phoneField = BASE_BOOKING_OBJECT?.shape?.phone ?? z.string().trim().min(8, 'Inserisci un numero di telefono valido');
const notesField = BASE_BOOKING_OBJECT?.shape?.notes ?? z.string().trim().max(500).optional();

const customerSchema = z.object({
  name: nameField,
  email: emailField,
  phone: phoneField,
});

const emailOnlyBookingSchema = z.object({
  eventInstanceId: z.number().int().positive(),
  customer: customerSchema,
  notes: notesField.nullish(),
});

function resolveBaseUrl(): string {
  const raw =
    process.env.APP_BASE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.BASE_URL ||
    'http://localhost:3000';
  return raw.replace(/\/$/, '');
}

export async function POST(req: Request) {
  try {
    const payload = await req.json();
    const parsed = emailOnlyBookingSchema.parse(payload);

    const event = await prisma.eventInstance.findUnique({
      where: { id: parsed.eventInstanceId },
    });

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

    const booking = await prisma.booking.create({
      data: {
        date: event.startAt,
        people: 1,
        type: 'evento',
        status: 'pending',
        name: parsed.customer.name,
        email: parsed.customer.email,
        phone: parsed.customer.phone,
        notes: notesValue && notesValue.length ? notesValue : null,
        agreePrivacy: false,
        agreeMarketing: false,
        prepayToken: null,
        tierType: 'evento',
        tierLabel: event.title ?? null,
        tierPriceCents: product?.priceCents ?? null,
      },
    });

    const verification = await issueBookingToken(booking.id, booking.email);

    const baseUrl = resolveBaseUrl();
    const confirmUrl = `${baseUrl}/checkout/confirm?token=${encodeURIComponent(verification.token)}`;

    const eventInfo = { title: event.title, startAt: event.startAt };

    await sendBookingRequestConfirmationEmail({
      booking,
      event: eventInfo,
      confirmUrl,
    });

    await sendBookingPendingNotificationEmail({ booking, event: eventInfo });

    return NextResponse.json(
      {
        ok: true,
        nextUrl: `/checkout/email-sent?bookingId=${booking.id}`,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ ok: false, error: 'invalid_payload', details: error.flatten() }, { status: 400 });
    }
    console.error('[bookings][email-only] error', error);
    return NextResponse.json({ ok: false, error: 'internal_error' }, { status: 500 });
  }
}
