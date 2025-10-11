// src/lib/mailer.ts
import nodemailer from 'nodemailer';
import type { Booking } from '@prisma/client';

const {
  SMTP_HOST,
  SMTP_PORT,
  SMTP_USER,
  SMTP_PASS,
  MAIL_FROM,
  MAIL_TO_BOOKINGS
} = process.env;

let cachedTransport: nodemailer.Transporter | null = null;

function hasSmtpConfig(): boolean {
  return Boolean(SMTP_HOST && SMTP_PORT && SMTP_USER && SMTP_PASS && MAIL_FROM);
}

export function getTransport() {
  if (cachedTransport) return cachedTransport;

  if (!hasSmtpConfig()) {
    throw new Error(
      'SMTP env vars mancanti: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM'
    );
  }
  const port = Number(SMTP_PORT);

  cachedTransport = nodemailer.createTransport({
    host: SMTP_HOST!,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER!, pass: SMTP_PASS! }
  });

  return cachedTransport;
}

type BookingEmailLunchSummary = {
  items: Array<{ dishId: number; name: string; priceCents: number; qty: number }>;
  subtotalCents: number;
  coverCents: number;
  totalCents: number;
};

type BookingEmailInput = {
  id: number;
  date: string; // ISO
  people: number;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
  lunch?: BookingEmailLunchSummary;
  dinner?: BookingEmailLunchSummary;
  tierLabel?: string;
  tierPriceCents?: number;
};

type BookingForNotification = Pick<
  Booking,
  'id' | 'name' | 'email' | 'phone' | 'notes' | 'date' | 'people' | 'tierLabel'
> & {
  eventInstanceId?: number | null;
  eventTitle?: string | null;
  eventStartAt?: Date | string | null;
};

type BookingEventDetails = {
  title?: string | null;
  startAt?: Date | string | null;
};

function normalizeDateInput(value: Date | string | null | undefined): Date | null {
  if (!value) return null;
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatBookingDateTime(value: Date | string | null | undefined): string | null {
  const date = normalizeDateInput(value);
  if (!date) return null;
  try {
    return date.toLocaleString('it-IT', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return null;
  }
}

function resolveBookingTitle(booking: BookingForNotification): string {
  return booking.eventTitle?.trim() || booking.tierLabel?.trim() || 'La Soluzione';
}

function resolveBookingWhen(booking: BookingForNotification): string | null {
  return (
    formatBookingDateTime(booking.eventStartAt ?? booking.date) ??
    formatBookingDateTime(booking.date)
  );
}

function sanitizeRecipient(email: string | null | undefined): string | null {
  if (!email) return null;
  const trimmed = email.trim();
  return trimmed.length ? trimmed : null;
}

function normalizeBaseUrl(value: string | null | undefined): string {
  if (!value) return '';
  return value.trim().replace(/\/$/, '');
}

function buildAbsoluteUrl(baseUrl: string, path: string): string {
  const normalized = normalizeBaseUrl(baseUrl);
  return normalized ? `${normalized}${path}` : path;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendBookingVerifyEmail(params: {
  to: string;
  bookingId: number | string;
  token: string;
  eventTitle: string;
  whenLabel: string;
  baseUrl: string;
}) {
  const recipient = sanitizeRecipient(params.to);
  if (!recipient) {
    console.warn('[mailer] sendBookingVerifyEmail skipped: destinatario mancante', {
      bookingId: params.bookingId,
    });
    return;
  }

  if (!hasSmtpConfig() || !MAIL_FROM) {
    console.info('[mailer] sendBookingVerifyEmail skipped (SMTP non configurato)', {
      bookingId: params.bookingId,
      to: recipient,
    });
    return;
  }

  const transporter = await ensureTransport();
  const confirmParams = new URLSearchParams({ token: params.token });
  const confirmPath = `/api/bookings/confirm?${confirmParams.toString()}`;
  const confirmUrl = buildAbsoluteUrl(params.baseUrl, confirmPath);
  const safeTitle = params.eventTitle?.trim() ? escapeHtml(params.eventTitle.trim()) : 'La Soluzione';
  const whenLabel = params.whenLabel?.trim();

  const subject = 'Conferma la tua prenotazione';
  const html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a;">
      <p style="margin:0 0 0.75rem;">Ciao,</p>
      <p style="margin:0 0 1rem;">Per completare la prenotazione #${escapeHtml(String(params.bookingId))} per <strong>${safeTitle}</strong>${
        whenLabel ? ` del <strong>${escapeHtml(whenLabel)}</strong>` : ''
      } clicca sul pulsante qui sotto.</p>
      <p style="margin:1.5rem 0;">
        <a href="${confirmUrl}" style="background:#2563eb;color:#fff;padding:0.75rem 1.25rem;border-radius:999px;text-decoration:none;font-weight:600;">Conferma la tua prenotazione</a>
      </p>
      <p style="margin:0 0 0.75rem;color:#475569;">Se il pulsante non funziona copia e incolla questo link nel browser:</p>
      <p style="margin:0 0 1.5rem;"><a href="${confirmUrl}" style="color:#2563eb;word-break:break-all;">${confirmUrl}</a></p>
      <p style="margin:0;color:#94a3b8;">Se non hai richiesto questa prenotazione puoi ignorare questo messaggio.</p>
    </div>
  `;

  const textLines = [
    `Conferma la prenotazione #${params.bookingId} per ${params.eventTitle?.trim() || 'La Soluzione'}.`,
    params.whenLabel?.trim() ? `Quando: ${params.whenLabel.trim()}` : '',
    confirmUrl,
    'Se non hai richiesto questa prenotazione ignora questo messaggio.',
  ].filter(Boolean);

  const info = await transporter.sendMail({
    from: MAIL_FROM,
    to: recipient,
    subject,
    html,
    text: textLines.join('\n'),
  });

  console.info('[mailer] sendBookingVerifyEmail sent', {
    messageId: info?.messageId ?? null,
    bookingId: params.bookingId,
  });
}

export async function sendOrderEmailVerifyLink(params: {
  to: string;
  name?: string;
  verifyUrl: string;
}) {
  const recipient = sanitizeRecipient(params.to);
  if (!recipient) {
    console.warn('[mailer] sendOrderEmailVerifyLink skipped: destinatario mancante');
    return;
  }

  if (!hasSmtpConfig() || !MAIL_FROM) {
    console.info('[mailer] sendOrderEmailVerifyLink skipped (SMTP non configurato)', {
      to: recipient,
    });
    return;
  }

  const transporter = await ensureTransport();
  const subject = 'Conferma il tuo ordine';
  const trimmedName = params.name?.trim();
  const greetingHtml = trimmedName ? ` ${escapeHtml(trimmedName)}` : '';
  const greetingText = trimmedName ? ` ${trimmedName}` : '';

  const html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a;">
      <p style="margin:0 0 0.75rem;">Ciao${greetingHtml},</p>
      <p style="margin:0 0 1rem;">per confermare il tuo ordine clicca qui:</p>
      <p style="margin:1.5rem 0;">
        <a href="${params.verifyUrl}" style="background:#2563eb;color:#fff;padding:0.75rem 1.25rem;border-radius:999px;text-decoration:none;font-weight:600;">Conferma il tuo ordine</a>
      </p>
      <p style="margin:0 0 1.5rem;color:#475569;">Il link scade tra 15 minuti. Se il pulsante non funziona copia e incolla questo link nel browser:</p>
      <p style="margin:0 0 1.5rem;"><a href="${params.verifyUrl}" style="color:#2563eb;word-break:break-all;">${params.verifyUrl}</a></p>
      <p style="margin:0;color:#94a3b8;">Se non hai richiesto questo ordine puoi ignorare questo messaggio.</p>
    </div>
  `;

  const text = [
    `Ciao${greetingText},`,
    '',
    'per confermare il tuo ordine clicca qui:',
    params.verifyUrl,
    '',
    'Il link scade tra 15 minuti. Se non hai richiesto questo ordine ignora questa email.',
  ].join('\n');

  const info = await transporter.sendMail({
    from: MAIL_FROM,
    to: recipient,
    subject,
    html,
    text,
  });

  console.info('[mailer] sendOrderEmailVerifyLink sent', {
    messageId: info?.messageId ?? null,
  });
}

export async function sendBookingConfirmedCustomer(params: {
  to: string;
  bookingId: number | string;
  eventTitle: string;
  whenLabel: string;
  people: number;
  baseUrl: string;
}) {
  const recipient = sanitizeRecipient(params.to);
  if (!recipient) {
    console.warn('[mailer] sendBookingConfirmedCustomer skipped: destinatario mancante', {
      bookingId: params.bookingId,
    });
    return;
  }

  if (!hasSmtpConfig() || !MAIL_FROM) {
    console.info('[mailer] sendBookingConfirmedCustomer skipped (SMTP non configurato)', {
      bookingId: params.bookingId,
      to: recipient,
    });
    return;
  }

  const transporter = await ensureTransport();
  const detailsPath = `/checkout/confirmed?bookingId=${encodeURIComponent(String(params.bookingId))}`;
  const detailsUrl = buildAbsoluteUrl(params.baseUrl, detailsPath);
  const subject = 'Prenotazione confermata';
  const whenLabel = params.whenLabel?.trim();
  const safeTitle = params.eventTitle?.trim() ? escapeHtml(params.eventTitle.trim()) : 'La Soluzione';

  const html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a;">
      <p style="margin:0 0 0.75rem;">Ciao,</p>
      <p style="margin:0 0 1rem;">La prenotazione #${escapeHtml(String(params.bookingId))} per <strong>${safeTitle}</strong>${
        whenLabel ? ` del <strong>${escapeHtml(whenLabel)}</strong>` : ''
      } è stata confermata.</p>
      <ul style="padding-left:1.25rem;margin:0 0 1.25rem;">
        <li><strong>Persone:</strong> ${params.people}</li>
        ${whenLabel ? `<li><strong>Quando:</strong> ${escapeHtml(whenLabel)}</li>` : ''}
      </ul>
      <p style="margin:1.5rem 0 0.75rem;">
        <a href="${detailsUrl}" style="background:#2563eb;color:#fff;padding:0.75rem 1.25rem;border-radius:999px;text-decoration:none;font-weight:600;">Dettagli</a>
      </p>
      <p style="margin:0;color:#475569;">Ti aspettiamo!</p>
    </div>
  `;

  const textLines = [
    `La prenotazione #${params.bookingId} è confermata.`,
    `Evento: ${params.eventTitle?.trim() || 'La Soluzione'}`,
    whenLabel ? `Quando: ${whenLabel}` : '',
    `Persone: ${params.people}`,
    `Dettagli: ${detailsUrl}`,
  ].filter(Boolean);

  const info = await transporter.sendMail({
    from: MAIL_FROM,
    to: recipient,
    subject,
    html,
    text: textLines.join('\n'),
  });

  console.info('[mailer] sendBookingConfirmedCustomer sent', {
    messageId: info?.messageId ?? null,
    bookingId: params.bookingId,
  });
}

export async function sendBookingConfirmedAdmin(params: {
  to: string;
  bookingId: number | string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  eventTitle: string;
  whenLabel: string;
  people: number;
}) {
  const recipient = sanitizeRecipient(params.to);
  if (!recipient) {
    console.warn('[mailer] sendBookingConfirmedAdmin skipped: destinatario mancante', {
      bookingId: params.bookingId,
    });
    return;
  }

  if (!hasSmtpConfig() || !MAIL_FROM) {
    console.info('[mailer] sendBookingConfirmedAdmin skipped (SMTP non configurato)', {
      bookingId: params.bookingId,
      to: recipient,
    });
    return;
  }

  const transporter = await ensureTransport();
  const subject = 'Nuova prenotazione confermata';
  const whenLabel = params.whenLabel?.trim();

  const html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a;">
      <p style="margin:0 0 0.5rem;">Prenotazione confermata.</p>
      <ul style="padding-left:1.25rem;margin:0 0 0.75rem;">
        <li><strong>ID:</strong> #${escapeHtml(String(params.bookingId))}</li>
        <li><strong>Evento:</strong> ${escapeHtml(params.eventTitle)}</li>
        ${whenLabel ? `<li><strong>Quando:</strong> ${escapeHtml(whenLabel)}</li>` : ''}
        <li><strong>Persone:</strong> ${params.people}</li>
        <li><strong>Cliente:</strong> ${escapeHtml(params.customerName)} (${escapeHtml(params.customerEmail)}${
          params.customerPhone ? `, ${escapeHtml(params.customerPhone)}` : ''
        })</li>
      </ul>
    </div>
  `;

  const textLines = [
    `Prenotazione confermata #${params.bookingId}`,
    `Evento: ${params.eventTitle}`,
    whenLabel ? `Quando: ${whenLabel}` : '',
    `Persone: ${params.people}`,
    `Cliente: ${params.customerName} (${params.customerEmail}${params.customerPhone ? `, ${params.customerPhone}` : ''})`,
  ].filter(Boolean);

  const info = await transporter.sendMail({
    from: MAIL_FROM,
    to: recipient,
    subject,
    html,
    text: textLines.join('\n'),
  });

  console.info('[mailer] sendBookingConfirmedAdmin sent', {
    messageId: info?.messageId ?? null,
    bookingId: params.bookingId,
  });
}

function resolveMailerBaseUrl(inputBaseUrl?: string | null): string {
  if (inputBaseUrl && inputBaseUrl.trim()) {
    return inputBaseUrl.trim().replace(/\/$/, '');
  }

  const rawBaseUrl =
    process.env.NEXT_PUBLIC_BASE_URL ??
    process.env.APP_BASE_URL ??
    process.env.BASE_URL ??
    '';

  return rawBaseUrl.trim().replace(/\/$/, '');
}

export async function sendBookingConfirmationToCustomer(input: {
  bookingId: number;
  orderId?: string | null;
  customerName?: string;
  customerEmail: string;
  customerPhone?: string;
  people?: number;
  eventTitle?: string;
  whenLabel?: string;
  baseUrl?: string;
}) {
  await sendBookingConfirmedCustomer({
    to: input.customerEmail,
    bookingId: input.bookingId,
    eventTitle: input.eventTitle ?? 'La Soluzione',
    whenLabel: input.whenLabel ?? '',
    people: input.people ?? 1,
    baseUrl: resolveMailerBaseUrl(input.baseUrl),
  });
}

export async function sendBookingNotificationToAdmin(input: {
  bookingId: number;
  orderId?: string | null;
  adminEmail: string;
  customerName?: string;
  customerEmail: string;
  customerPhone?: string;
  people?: number;
  eventTitle?: string;
  whenLabel?: string;
}) {
  await sendBookingConfirmedAdmin({
    to: input.adminEmail,
    bookingId: input.bookingId,
    customerName: input.customerName ?? 'Cliente',
    customerEmail: input.customerEmail,
    customerPhone: input.customerPhone ?? '',
    eventTitle: input.eventTitle ?? 'La Soluzione',
    whenLabel: input.whenLabel ?? '',
    people: input.people ?? 1,
  });
}

function logBookingEmail(
  label: string,
  booking: BookingForNotification,
  info: { messageId?: string | null }
) {
  console.info(`[mailer] ${label}`, {
    messageId: info?.messageId ?? null,
    bookingId: booking.id,
    eventInstanceId: booking.eventInstanceId ?? null,
  });
}

export async function bookingRequestCustomer(
  email: string,
  {
    booking,
    confirmUrl,
  }: {
    booking: BookingForNotification;
    confirmUrl: string;
  }
) {
  const recipient = sanitizeRecipient(email);
  if (!recipient) {
    console.warn('[mailer] bookingRequestCustomer skipped: destinatario mancante', {
      bookingId: booking.id,
    });
    return;
  }

  if (!hasSmtpConfig() || !MAIL_FROM) {
    console.info('[mailer] bookingRequestCustomer skipped (SMTP non configurato)', {
      bookingId: booking.id,
      to: recipient,
    });
    return;
  }

  const transporter = await ensureTransport();
  const subject = 'Richiesta: Conferma la tua prenotazione';
  const title = resolveBookingTitle(booking);
  const when = resolveBookingWhen(booking);

  const html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a;">
      <p style="margin:0 0 0.75rem;">Ciao ${booking.name},</p>
      <p style="margin:0 0 1rem;">per completare la prenotazione #${booking.id}${
        title ? ` per <strong>${title}</strong>` : ''
      }${when ? ` del <strong>${when}</strong>` : ''} conferma con un clic.</p>
      <p style="margin:1.5rem 0;"><a href="${confirmUrl}" style="background:#2563eb;color:#fff;padding:0.75rem 1.25rem;border-radius:999px;text-decoration:none;font-weight:600;">Conferma prenotazione</a></p>
      <p style="color:#475569;margin:0;">Se non hai richiesto questa prenotazione puoi ignorare il messaggio.</p>
    </div>
  `;

  const text = [
    `Ciao ${booking.name},`,
    '',
    `Conferma la prenotazione #${booking.id}${title ? ` per ${title}` : ''}${
      when ? ` del ${when}` : ''
    }.`,
    confirmUrl,
    '',
    'Se non hai richiesto questa prenotazione ignora il messaggio.',
  ].join('\n');

  const info = await transporter.sendMail({
    from: MAIL_FROM,
    to: recipient,
    subject,
    html,
    text,
  });

  logBookingEmail('bookingRequestCustomer sent', booking, info);
}

export async function bookingPendingAdmin(
  email: string,
  { booking }: { booking: BookingForNotification }
) {
  const recipient = sanitizeRecipient(email);
  if (!recipient) {
    console.warn('[mailer] bookingPendingAdmin skipped: destinatario mancante', {
      bookingId: booking.id,
    });
    return;
  }

  if (!hasSmtpConfig() || !MAIL_FROM) {
    console.info('[mailer] bookingPendingAdmin skipped (SMTP non configurato)', {
      bookingId: booking.id,
      to: recipient,
    });
    return;
  }

  const transporter = await ensureTransport();
  const subject = 'Richiesta: Prenotazione da confermare';
  const title = resolveBookingTitle(booking);
  const when = resolveBookingWhen(booking);
  const people = typeof booking.people === 'number' ? booking.people : 1;

  const html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a;">
      <p style="margin:0 0 0.5rem;">Nuova prenotazione in attesa.</p>
      <ul style="padding-left:1.25rem;margin:0 0 0.75rem;">
        <li><strong>ID:</strong> #${booking.id}</li>
        <li><strong>Cliente:</strong> ${booking.name} (${booking.email}${
          booking.phone ? `, ${booking.phone}` : ''
        })</li>
        ${title ? `<li><strong>Evento:</strong> ${title}</li>` : ''}
        ${when ? `<li><strong>Quando:</strong> ${when}</li>` : ''}
        <li><strong>Persone:</strong> ${people}</li>
        ${booking.notes ? `<li><strong>Note:</strong> ${booking.notes}</li>` : ''}
      </ul>
      <p style="margin:0;">Verifica e conferma dal pannello.</p>
    </div>
  `;

  const textLines = [
    'Nuova prenotazione in attesa.',
    `ID: #${booking.id}`,
    `Cliente: ${booking.name} (${booking.email}${booking.phone ? `, ${booking.phone}` : ''})`,
    title ? `Evento: ${title}` : '',
    when ? `Quando: ${when}` : '',
    `Persone: ${people}`,
    booking.notes ? `Note: ${booking.notes}` : '',
    'Verifica e conferma dal pannello.',
  ].filter(Boolean);

  const info = await transporter.sendMail({
    from: MAIL_FROM,
    to: recipient,
    subject,
    html,
    text: textLines.join('\n'),
  });

  logBookingEmail('bookingPendingAdmin sent', booking, info);
}

export async function bookingConfirmedCustomer(
  email: string,
  { booking }: { booking: BookingForNotification }
) {
  const recipient = sanitizeRecipient(email);
  if (!recipient) {
    console.warn('[mailer] bookingConfirmedCustomer skipped: destinatario mancante', {
      bookingId: booking.id,
    });
    return;
  }

  if (!hasSmtpConfig() || !MAIL_FROM) {
    console.info('[mailer] bookingConfirmedCustomer skipped (SMTP non configurato)', {
      bookingId: booking.id,
      to: recipient,
    });
    return;
  }

  const transporter = await ensureTransport();
  const subject = 'Conferma: Prenotazione confermata';
  const title = resolveBookingTitle(booking);
  const when = resolveBookingWhen(booking);
  const people = typeof booking.people === 'number' ? booking.people : 1;

  const html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a;">
      <p style="margin:0 0 0.75rem;">Ciao ${booking.name},</p>
      <p style="margin:0 0 1rem;">la tua prenotazione #${booking.id}${
        title ? ` per <strong>${title}</strong>` : ''
      } è confermata${when ? ` per <strong>${when}</strong>` : ''}.</p>
      <ul style="padding-left:1.25rem;margin:0 0 0.75rem;">
        ${when ? `<li><strong>Quando:</strong> ${when}</li>` : ''}
        <li><strong>Persone:</strong> ${people}</li>
        ${booking.notes ? `<li><strong>Note:</strong> ${booking.notes}</li>` : ''}
      </ul>
      <p style="margin:0;">Ti aspettiamo a La Soluzione.</p>
    </div>
  `;

  const textLines = [
    `Ciao ${booking.name},`,
    '',
    `La prenotazione #${booking.id}${title ? ` per ${title}` : ''} è confermata${
      when ? ` per ${when}` : ''
    }.`,
    `Persone: ${people}`,
    booking.notes ? `Note: ${booking.notes}` : '',
    'Ti aspettiamo a La Soluzione.',
  ].filter(Boolean);

  const info = await transporter.sendMail({
    from: MAIL_FROM,
    to: recipient,
    subject,
    html,
    text: textLines.join('\n'),
  });

  logBookingEmail('bookingConfirmedCustomer sent', booking, info);
}

export async function bookingConfirmedAdmin(
  email: string,
  { booking }: { booking: BookingForNotification }
) {
  const recipient = sanitizeRecipient(email);
  if (!recipient) {
    console.warn('[mailer] bookingConfirmedAdmin skipped: destinatario mancante', {
      bookingId: booking.id,
    });
    return;
  }

  if (!hasSmtpConfig() || !MAIL_FROM) {
    console.info('[mailer] bookingConfirmedAdmin skipped (SMTP non configurato)', {
      bookingId: booking.id,
      to: recipient,
    });
    return;
  }

  const transporter = await ensureTransport();
  const subject = 'Conferma: Prenotazione confermata';
  const title = resolveBookingTitle(booking);
  const when = resolveBookingWhen(booking);
  const people = typeof booking.people === 'number' ? booking.people : 1;

  const html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;color:#0f172a;">
      <p style="margin:0 0 0.5rem;">Prenotazione confermata.</p>
      <ul style="padding-left:1.25rem;margin:0 0 0.75rem;">
        <li><strong>ID:</strong> #${booking.id}</li>
        <li><strong>Cliente:</strong> ${booking.name} (${booking.email}${
          booking.phone ? `, ${booking.phone}` : ''
        })</li>
        ${title ? `<li><strong>Evento:</strong> ${title}</li>` : ''}
        ${when ? `<li><strong>Quando:</strong> ${when}</li>` : ''}
        <li><strong>Persone:</strong> ${people}</li>
        ${booking.notes ? `<li><strong>Note:</strong> ${booking.notes}</li>` : ''}
      </ul>
      <p style="margin:0;">Aggiorna il planning se necessario.</p>
    </div>
  `;

  const textLines = [
    'Prenotazione confermata.',
    `ID: #${booking.id}`,
    `Cliente: ${booking.name} (${booking.email}${booking.phone ? `, ${booking.phone}` : ''})`,
    title ? `Evento: ${title}` : '',
    when ? `Quando: ${when}` : '',
    `Persone: ${people}`,
    booking.notes ? `Note: ${booking.notes}` : '',
    'Aggiorna il planning se necessario.',
  ].filter(Boolean);

  const info = await transporter.sendMail({
    from: MAIL_FROM,
    to: recipient,
    subject,
    html,
    text: textLines.join('\n'),
  });

  logBookingEmail('bookingConfirmedAdmin sent', booking, info);
}

export async function sendBookingEmails(data: BookingEmailInput) {
  const transporter = getTransport();

  // Opzionale: verifica connessione/credenziali
  try {
    await transporter.verify();
  } catch (e) {
    console.error('[mailer.verify] errore:', e);
    throw e;
  }

  const from = MAIL_FROM!;
  const toAdmin = MAIL_TO_BOOKINGS || 'info@lasoluzione.eu';

  const when = new Date(data.date);
  const dateHuman = when.toLocaleString('it-IT', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const euro = (cents: number) =>
    (cents / 100).toLocaleString('it-IT', { style: 'currency', currency: 'EUR' });

  const lunchText = (() => {
    if (!data.lunch) return '';
    const coverTotal = data.lunch.coverCents * data.people;
    const lines = data.lunch.items
      .filter(item => item.qty > 0)
      .map(item => {
        const lineTotal = euro(item.priceCents * item.qty);
        return `  • ${item.qty}× ${item.name} – ${euro(item.priceCents)} cad. (Tot ${lineTotal})`;
      })
      .join('\n');
    return `\nSelezione pranzo:\n${lines}\nCoperto (${euro(data.lunch.coverCents)} x ${data.people}): ${euro(coverTotal)}\nTotale pranzo: ${euro(data.lunch.totalCents)}\n`;
  })();

  const lunchHtml = (() => {
    if (!data.lunch) return '';
    const coverTotal = data.lunch.coverCents * data.people;
    const items = data.lunch.items
      .filter(item => item.qty > 0)
      .map(item => {
        const lineTotal = euro(item.priceCents * item.qty);
        return `<li>${item.qty} × ${item.name} — <strong>${euro(item.priceCents)}</strong> cad. (Tot <strong>${lineTotal}</strong>)</li>`;
      })
      .join('');
    return `
      <h3 style="margin-top:1.5rem;">Selezione pranzo</h3>
      <ul>${items}</ul>
      <p><strong>Coperto:</strong> ${euro(data.lunch.coverCents)} × ${data.people} = ${euro(coverTotal)}</p>
      <p><strong>Totale pranzo:</strong> ${euro(data.lunch.totalCents)}</p>
    `;
  })();

  const dinnerText = (() => {
    const dinner = data.dinner;
    if (!dinner || !Array.isArray(dinner.items) || dinner.totalCents == null) {
      return '';
    }
    const lines = dinner.items
      .filter((item) => item && item.qty > 0)
      .map((item) => {
        const lineTotalCents = item.priceCents * item.qty;
        return `• ${item.qty} × ${item.name} — ${euro(lineTotalCents)}`;
      })
      .join('\n');
    return `\n--- CENA ---\n${lines}\nCoperto: ${euro(dinner.coverCents)}\nTotale cena: ${euro(dinner.totalCents)}\n`;
  })();

  const dinnerHtml = (() => {
    if (!data.dinner) return '';
    const coverTotal = data.dinner.coverCents * data.people;
    const items = data.dinner.items
      .filter(item => item.qty > 0)
      .map(item => {
        const lineTotal = euro(item.priceCents * item.qty);
        return `<li>${item.qty} × ${item.name} — <strong>${euro(item.priceCents)}</strong> cad. (Tot <strong>${lineTotal}</strong>)</li>`;
      })
      .join('');
    return `
      <h3 style="margin-top:1.5rem;">Selezione cena</h3>
      <ul>${items}</ul>
      <p><strong>Coperto:</strong> ${euro(data.dinner.coverCents)} × ${data.people} = ${euro(coverTotal)}</p>
      <p><strong>Totale cena:</strong> ${euro(data.dinner.totalCents)}</p>
    `;
  })();

  const hasTierInfo = data.tierLabel && typeof data.tierPriceCents === 'number';
  const tierText = hasTierInfo
    ? `\nOpzione: ${data.tierLabel} (${euro(data.tierPriceCents!)})\n`
    : data.tierLabel
      ? `\nOpzione: ${data.tierLabel}\n`
      : '';

  const tierHtml = hasTierInfo
    ? `<li><strong>Opzione:</strong> ${data.tierLabel} (${euro(data.tierPriceCents!)})</li>`
    : data.tierLabel
      ? `<li><strong>Opzione:</strong> ${data.tierLabel}</li>`
      : '';

  // Email al cliente
  const r1 = await transporter.sendMail({
    from,
    to: data.email,
    subject: `Prenotazione ricevuta – Bar La Soluzione (#${data.id})`,
    text:
`Ciao ${data.name},

abbiamo ricevuto la tua prenotazione:

• Data/Ora: ${dateHuman}
• Persone: ${data.people}
${data.phone ? `• Telefono: ${data.phone}\n` : ''}${data.notes ? `• Note: ${data.notes}\n` : ''}${tierText}${lunchText}${dinnerText}

Presentati in cassa dicendo:
“Prenotazione a nome ${data.name}, numero ${data.people}, codice #${data.id}”.

A presto!
Bar La Soluzione
`,
    html:
`<p>Ciao <strong>${data.name}</strong>,</p>
<p>Abbiamo ricevuto la tua prenotazione:</p>
<ul>
  <li><strong>Data/Ora:</strong> ${dateHuman}</li>
  <li><strong>Persone:</strong> ${data.people}</li>
  ${data.phone ? `<li><strong>Telefono:</strong> ${data.phone}</li>` : ''}
  ${data.notes ? `<li><strong>Note:</strong> ${data.notes}</li>` : ''}
  ${tierHtml}
</ul>
${lunchHtml}
${dinnerHtml}
<p>In cassa comunica:<br/><em>“Prenotazione a nome ${data.name}, ${data.people} persone, codice #${data.id}”.</em></p>
<p>A presto!<br/>Bar La Soluzione</p>`
  });
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[mailer] email cliente sent', r1.messageId);
  }

  // Email al bar
  const r2 = await transporter.sendMail({
    from,
    to: toAdmin,
    subject: `Nuova prenotazione #${data.id} – ${data.name} (${data.people}p)`,
    text:
`Nuova prenotazione:

ID: ${data.id}
Data/Ora: ${dateHuman}
Persone: ${data.people}
Nome: ${data.name}
Email: ${data.email}
${data.phone ? `Telefono: ${data.phone}\n` : ''}${data.notes ? `Note: ${data.notes}\n` : ''}${tierText}${lunchText}${dinnerText}`
  });
  if (process.env.NODE_ENV !== 'production') {
    console.warn('[mailer] email admin sent', r2.messageId);
  }
}

export async function sendBookingRequestConfirmationEmail({
  booking,
  event,
  confirmUrl,
}: {
  booking: BookingForNotification;
  event?: BookingEventDetails;
  confirmUrl: string;
}) {
  const recipient = booking.email?.trim();
  if (!recipient) {
    console.warn('[mailer] richiesta conferma non inviata: email mancante', { bookingId: booking.id });
    return;
  }

  if (!hasSmtpConfig() || !MAIL_FROM) {
    console.info('[mailer] sendBookingRequestConfirmationEmail skipped (SMTP non configurato)', {
      bookingId: booking.id,
      to: recipient,
    });
    return;
  }

  const transporter = await ensureTransport();
  const eventTitle = event?.title?.trim() || booking.tierLabel?.trim() || 'La Soluzione';
  const when = formatBookingDateTime(event?.startAt ?? booking.date);
  const subject = eventTitle
    ? `Conferma prenotazione – ${eventTitle}`
    : 'Conferma prenotazione – La Soluzione';

  const phoneLine = booking.phone ? `<li><strong>Telefono:</strong> ${booking.phone}</li>` : '';
  const notesLine = booking.notes ? `<li><strong>Note:</strong> ${booking.notes}</li>` : '';
  const whenLine = when ? `<li><strong>Quando:</strong> ${when}</li>` : '';

  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #0f172a;">
      <h1 style="font-size: 1.35rem; margin-bottom: 0.5rem;">Quasi fatto!</h1>
      <p style="margin: 0 0 1rem;">Conferma la prenotazione #${booking.id} per completare la richiesta.</p>
      <ul style="padding-left: 1.25rem;">
        ${whenLine}
        <li><strong>Nome:</strong> ${booking.name}</li>
        ${phoneLine}
        ${notesLine}
      </ul>
      <p style="margin: 1.5rem 0;"><a href="${confirmUrl}" style="background:#2563eb;color:#fff;padding:0.75rem 1.25rem;border-radius:999px;text-decoration:none;font-weight:600;">Conferma prenotazione</a></p>
      <p style="color:#475569;">Se non hai richiesto questa prenotazione puoi ignorare questo messaggio.</p>
    </div>
  `;

  const textLines = [
    `Conferma la prenotazione #${booking.id}.`,
    when ? `Quando: ${when}` : '',
    `Nome: ${booking.name}`,
    booking.phone ? `Telefono: ${booking.phone}` : '',
    booking.notes ? `Note: ${booking.notes}` : '',
    `Conferma: ${confirmUrl}`,
    'Se non hai richiesto questa prenotazione ignora questo messaggio.',
  ]
    .filter(Boolean)
    .join('\n');

  await transporter.sendMail({
    from: MAIL_FROM,
    to: recipient,
    subject,
    html,
    text: textLines,
  });
}

export async function sendBookingPendingNotificationEmail({
  booking,
  event,
}: {
  booking: BookingForNotification;
  event?: BookingEventDetails;
}) {
  const recipients = adminRecipients();
  if (!recipients.length) {
    console.warn('[mailer] notifica prenotazione pending non inviata: nessun destinatario', {
      bookingId: booking.id,
    });
    return;
  }

  if (!hasSmtpConfig() || !MAIL_FROM) {
    console.info('[mailer] sendBookingPendingNotificationEmail skipped (SMTP non configurato)', {
      bookingId: booking.id,
      to: recipients,
    });
    return;
  }

  const transporter = await ensureTransport();
  const eventTitle = event?.title?.trim() || booking.tierLabel?.trim();
  const when = formatBookingDateTime(event?.startAt ?? booking.date);
  const subject = `Prenotazione da confermare #${booking.id}`;

  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #0f172a;">
      <h1 style="font-size: 1.1rem; margin-bottom: 0.5rem;">Nuova prenotazione in attesa</h1>
      <p style="margin:0 0 0.5rem;"><strong>#${booking.id}</strong> – ${booking.name} (${booking.email}${
        booking.phone ? `, ${booking.phone}` : ''
      })</p>
      ${eventTitle ? `<p style="margin:0 0 0.25rem;"><strong>Evento:</strong> ${eventTitle}</p>` : ''}
      ${when ? `<p style="margin:0 0 0.25rem;"><strong>Quando:</strong> ${when}</p>` : ''}
      <p style="margin:0;">Persone: ${typeof booking.people === 'number' ? booking.people : 1}</p>
      ${booking.notes ? `<p style="margin-top:0.75rem;"><strong>Note:</strong> ${booking.notes}</p>` : ''}
    </div>
  `;

  const textLines = [
    `Prenotazione pending #${booking.id}`,
    `Cliente: ${booking.name} (${booking.email}${booking.phone ? `, ${booking.phone}` : ''})`,
    eventTitle ? `Evento: ${eventTitle}` : '',
    when ? `Quando: ${when}` : '',
    `Persone: ${typeof booking.people === 'number' ? booking.people : 1}`,
    booking.notes ? `Note: ${booking.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  await transporter.sendMail({
    from: MAIL_FROM,
    to: recipients,
    subject,
    html,
    text: textLines,
  });
}

function parseBookingItems(value: unknown): Array<{ name: string; qty: number; priceCents: number }> {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map((item) => ({
        name: typeof item?.name === 'string' ? item.name : '',
        qty: typeof item?.qty === 'number' ? item.qty : Number(item?.qty ?? 0),
        priceCents: typeof item?.priceCents === 'number' ? item.priceCents : Number(item?.priceCents ?? 0),
      }))
      .filter((item) => item.name);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return parseBookingItems(parsed);
    } catch {
      return [];
    }
  }

  return [];
}

async function ensureTransport() {
  const transporter = getTransport();
  try {
    await transporter.verify();
  } catch (error) {
    console.warn('[mailer] verify SMTP fallita, continuo', error);
  }
  return transporter;
}

type OrderMailItem = {
  name: string;
  qty: number;
  priceCents: number;
  totalCents?: number;
};

type BasicOrderInfo = {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  notes?: string | null;
  totalCents?: number | null;
};

function itemsTotalCents(items: OrderMailItem[], fallback?: number | null): number {
  const sum = items.reduce((acc, item) => acc + item.priceCents * item.qty, 0);
  if (sum > 0) return sum;
  return typeof fallback === 'number' ? fallback : 0;
}

function renderItemsHtml(items: OrderMailItem[]): string {
  if (items.length === 0) return '';
  const rows = items
    .map(
      (item) =>
        `<li>${item.qty} × ${item.name} — <strong>${euro(item.priceCents * item.qty)}</strong></li>`
    )
    .join('');
  return `<ul>${rows}</ul>`;
}

function renderItemsText(items: OrderMailItem[]): string {
  if (items.length === 0) return '';
  return items
    .map((item) => `• ${item.qty} × ${item.name} — ${euro(item.priceCents * item.qty)}`)
    .join('\n');
}

function resolveBaseUrl() {
  const fromEnv = process.env.NEXT_PUBLIC_BASE_URL || process.env.BASE_URL || 'http://localhost:3000';
  return fromEnv.replace(/\/$/, '');
}

function shortId(id: string) {
  if (!id) return '';
  return id.length <= 8 ? id.toUpperCase() : id.slice(-8).toUpperCase();
}

function adminRecipients(): string[] {
  const list = new Set<string>();
  const fromEnv = process.env.ADMIN_EMAILS;
  if (fromEnv) {
    fromEnv
      .split(',')
      .map((email) => email.trim())
      .filter(Boolean)
      .forEach((email) => list.add(email));
  }
  if (MAIL_TO_BOOKINGS) list.add(MAIL_TO_BOOKINGS);
  if (!list.size && MAIL_FROM) list.add(MAIL_FROM);
  return Array.from(list);
}

export async function sendOrderConfirmation({
  to,
  order,
  items,
}: {
  to?: string | null;
  order: BasicOrderInfo;
  items: OrderMailItem[];
}) {
  const recipient = (to || order.email)?.trim();
  if (!recipient) {
    console.warn('[mailer] conferma ordine non inviata: destinatario mancante', { orderId: order.id });
    return;
  }

  if (!hasSmtpConfig() || !MAIL_FROM) {
    console.info('[mailer] sendOrderConfirmation skipped (SMTP non configurato)', {
      to: recipient,
      orderId: order.id,
    });
    return;
  }

  const transporter = await ensureTransport();
  const totalCents = itemsTotalCents(items, order.totalCents);
  const reviewUrl = `${resolveBaseUrl()}/checkout/return?orderId=${encodeURIComponent(order.id)}`;

  const subject = `Conferma ordine #${shortId(order.id)} – La Soluzione`;
  const itemsHtml = renderItemsHtml(items);
  const itemsText = renderItemsText(items);

  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #0f172a;">
      <h1 style="font-size: 1.35rem; margin-bottom: 0.5rem;">Grazie per l’ordine</h1>
      <p style="margin: 0 0 1rem;">Ordine <strong>#${order.id}</strong> a nome <strong>${order.name}</strong>.</p>
      <p style="margin: 0 0 1rem;">Totale: <strong>${euro(totalCents)}</strong></p>
      ${itemsHtml ? `<h2 style="font-size:1.05rem; margin-top:1.5rem;">Dettaglio prodotti</h2>${itemsHtml}` : ''}
      ${order.notes ? `<p style="margin-top:1rem;"><strong>Note:</strong> ${order.notes}</p>` : ''}
      <p style="margin-top:1.5rem;">Telefono: ${order.phone ?? 'non fornito'}</p>
      <p style="margin-top:2rem;"><a href="${reviewUrl}" style="color:#2563eb; font-weight:600;">Rivedi ordine</a></p>
      <p style="margin-top:2rem; color:#475569;">A presto!<br/>La Soluzione</p>
    </div>
  `;

  const text = [
    `Grazie per l’ordine #${order.id}.`,
    `Totale: ${euro(totalCents)}.`,
    itemsText,
    order.notes ? `Note: ${order.notes}` : '',
    `Telefono: ${order.phone ?? 'non fornito'}`,
    `Rivedi ordine: ${reviewUrl}`,
  ]
    .filter(Boolean)
    .join('\n\n');

  await transporter.sendMail({
    from: MAIL_FROM,
    to: recipient,
    subject,
    html,
    text,
  });
}

export async function sendOrderNotificationToAdmin({
  order,
  items,
  booking,
}: {
  order: BasicOrderInfo;
  items: OrderMailItem[];
  booking?: { date?: Date | string | null; people?: number | null } | null;
}) {
  const recipients = adminRecipients();
  if (recipients.length === 0) {
    console.warn('[mailer] notifica admin non inviata: nessun destinatario');
    return;
  }

  if (!hasSmtpConfig() || !MAIL_FROM) {
    console.info('[mailer] sendOrderNotificationToAdmin skipped (SMTP non configurato)', {
      orderId: order.id,
      to: recipients,
    });
    return;
  }

  const transporter = await ensureTransport();
  const totalCents = itemsTotalCents(items, order.totalCents);
  const itemsHtml = renderItemsHtml(items);
  const itemsText = renderItemsText(items);
  const bookingInfo = booking?.date
    ? new Date(booking.date).toLocaleString('it-IT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : null;

  const subject = `Nuovo ordine #${shortId(order.id)} (${euro(totalCents)})`;
  const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; color: #0f172a;">
      <h1 style="font-size: 1.25rem;">Nuovo ordine ricevuto</h1>
      <p><strong>#${order.id}</strong> – ${order.name} (${order.email}${order.phone ? `, ${order.phone}` : ''})</p>
      <p><strong>Totale:</strong> ${euro(totalCents)}</p>
      ${bookingInfo ? `<p><strong>Data:</strong> ${bookingInfo}</p>` : ''}
      ${typeof booking?.people === 'number' ? `<p><strong>Persone:</strong> ${booking.people}</p>` : ''}
      ${itemsHtml ? `<h2 style="font-size:1.05rem; margin-top:1.5rem;">Dettaglio</h2>${itemsHtml}` : ''}
      ${order.notes ? `<p style="margin-top:1rem;"><strong>Note cliente:</strong> ${order.notes}</p>` : ''}
    </div>
  `;

  const text = [
    `Nuovo ordine #${order.id}`,
    `Cliente: ${order.name} (${order.email}${order.phone ? `, ${order.phone}` : ''})`,
    `Totale: ${euro(totalCents)}`,
    bookingInfo ? `Data: ${bookingInfo}` : '',
    typeof booking?.people === 'number' ? `Persone: ${booking.people}` : '',
    itemsText,
    order.notes ? `Note cliente: ${order.notes}` : '',
  ]
    .filter(Boolean)
    .join('\n');

  await transporter.sendMail({
    from: MAIL_FROM,
    to: recipients,
    subject,
    html,
    text,
  });
}

export async function sendOrderFailure({
  order,
  reason,
}: {
  order: { id: string; email?: string | null; name?: string | null };
  reason?: string | null;
}) {
  const subject = `Problema con l’ordine #${shortId(order.id)} – La Soluzione`;
  const reasonText = reason ? reason.toString() : 'transazione non completata';

  if (order.email && hasSmtpConfig() && MAIL_FROM) {
    const transporter = await ensureTransport();
    const text = [
      `Ciao ${order.name ?? ''},`,
      `abbiamo riscontrato un problema con il pagamento dell’ordine #${order.id}.`,
      `Dettagli: ${reasonText}.`,
      'Se il pagamento è andato a buon fine contattaci rispondendo a questa email.',
    ].join('\n\n');

    const html = `
      <p>Ciao ${order.name ?? ''},</p>
      <p>abbiamo riscontrato un problema con il pagamento dell’ordine <strong>#${order.id}</strong>.</p>
      <p>Dettagli: <strong>${reasonText}</strong>.</p>
      <p>Se hai già completato il pagamento rispondi a questa email o contattaci telefonicamente.</p>
    `;

    await transporter.sendMail({ from: MAIL_FROM, to: order.email, subject, text, html });
  } else {
    console.info('[mailer] ordine fallito: email cliente non inviata', { orderId: order.id });
  }

  const recipients = adminRecipients();
  if (recipients.length && hasSmtpConfig() && MAIL_FROM) {
    const transporter = await ensureTransport();
    await transporter.sendMail({
      from: MAIL_FROM,
      to: recipients,
      subject,
      text: `Ordine #${order.id} non completato. Motivo: ${reasonText}.`,
    });
  }
}

export async function sendCustomerOrderEmail({ order, booking }: { order: any; booking: any }) {
  if (!order?.email) {
    console.warn('[mailer] email cliente non inviata: manca indirizzo');
    return;
  }

  if (!hasSmtpConfig() || !MAIL_FROM) {
    console.info('[mailer] sendCustomerOrderEmail skipped (SMTP non configurato)', {
      to: order.email,
      orderId: order.id,
    });
    return;
  }

  const transporter = await ensureTransport();
  const items = parseBookingItems(booking?.lunchItemsJson);
  const totalCents = typeof booking?.totalCents === 'number' ? booking.totalCents : 0;
  const itemsHtml = items
    .map(
      (item) =>
        `<li>${item.qty} × ${item.name} — <strong>${euro(item.priceCents)}</strong> cad. (Tot ${euro(
          item.priceCents * item.qty,
        )})</li>`,
    )
    .join('');

  const html = `
    <h1>Grazie per l’ordine</h1>
    <p>Ordine #${order.id} — Totale ${euro(totalCents)}</p>
    ${itemsHtml ? `<p>Dettaglio prodotti:</p><ul>${itemsHtml}</ul>` : ''}
  `;

  const textLines = [`Grazie per l’ordine #${order.id}.`, `Totale: ${euro(totalCents)}.`];
  if (items.length > 0) {
    textLines.push('Dettaglio prodotti:');
    items.forEach((item) => textLines.push(`- ${item.qty} × ${item.name} — ${euro(item.priceCents * item.qty)}`));
  }

  await transporter.sendMail({
    from: MAIL_FROM,
    to: order.email,
    subject: 'Conferma ordine',
    html,
    text: textLines.join('\n'),
  });
}

export async function sendAdminOrderEmail({ order, booking }: { order: any; booking: any }) {
  const to = MAIL_TO_BOOKINGS || MAIL_FROM;
  if (!to) {
    console.warn('[mailer] email admin non inviata: destinatario mancante');
    return;
  }

  if (!hasSmtpConfig() || !MAIL_FROM) {
    console.info('[mailer] sendAdminOrderEmail skipped (SMTP non configurato)', {
      to,
      orderId: order?.id,
    });
    return;
  }

  const transporter = await ensureTransport();
  const totalCents = typeof booking?.totalCents === 'number' ? booking.totalCents : 0;

  const phoneText = order?.phone ? `, ${order.phone}` : '';
  const html = `
    <h1>Nuovo ordine</h1>
    <p>#${order?.id} — Cliente: ${order?.name ?? ''} (${order?.email ?? ''}${phoneText})</p>
    <p>Totale: ${euro(totalCents)}</p>
  `;

  const text = `Nuovo ordine #${order?.id}
Cliente: ${order?.name ?? ''} (${order?.email ?? ''}${phoneText})
Totale: ${euro(totalCents)}`;

  await transporter.sendMail({
    from: MAIL_FROM,
    to,
    subject: 'Nuovo ordine ricevuto',
    html,
    text,
  });
}

const EURO_FORMATTER = new Intl.NumberFormat('it-IT', {
  style: 'currency',
  currency: 'EUR',
});

function euro(amountCents: number) {
  return EURO_FORMATTER.format(amountCents / 100);
}

export type OrderPaymentEmailInput = {
  to: string;
  orderId: string;
  amountCents: number;
  hostedPaymentUrl?: string;
};

export type OrderPaymentEmailResult = {
  ok: boolean;
  skipped?: boolean;
  error?: string;
  messageId?: string;
};

export async function sendOrderPaymentEmail(
  input: OrderPaymentEmailInput
): Promise<OrderPaymentEmailResult> {
  const from = MAIL_FROM;
  const subject = `Completa il pagamento del tuo ordine #${input.orderId}`;
  const amount = euro(input.amountCents);
  const buttonHtml = input.hostedPaymentUrl
    ? `<p style="margin:2rem 0; text-align:center;"><a href="${input.hostedPaymentUrl}" style="display:inline-block;padding:0.85rem 1.75rem;border-radius:999px;background:#14532d;color:#fff;font-weight:600;text-decoration:none;">Paga ora</a></p>`
    : '';
  const linkText = input.hostedPaymentUrl
    ? `Paga ora: ${input.hostedPaymentUrl}`
    : 'Accedi alla tua area personale per completare il pagamento.';

  const textBody = `Ciao,

abbiamo creato il tuo ordine #${input.orderId} per un totale di ${amount}.

${linkText}

Se hai già pagato ignora questo messaggio.`;

  const htmlBody = `
    <p>Ciao,</p>
    <p>abbiamo creato il tuo ordine <strong>#${input.orderId}</strong> per un totale di <strong>${amount}</strong>.</p>
    ${buttonHtml || ''}
    ${input.hostedPaymentUrl ? `<p style="text-align:center; color:#6b7280; font-size:0.95rem;">Se il pulsante non funziona copia e incolla questo link nel browser:<br /><a href="${input.hostedPaymentUrl}">${input.hostedPaymentUrl}</a></p>` : ''}
    <p style="margin-top:2rem; color:#475569;">Se hai già completato il pagamento puoi ignorare questa email.</p>
    <p style="margin-top:1.5rem;">Grazie!<br/>Bar La Soluzione</p>
  `;

  if (!hasSmtpConfig() || !from) {
    console.info('[mailer] sendOrderPaymentEmail skipped (SMTP non configurato)', {
      to: input.to,
      subject,
      text: textBody,
      hostedPaymentUrl: input.hostedPaymentUrl,
    });
    return { ok: false, skipped: true, error: 'SMTP non configurato' };
  }

  try {
    const transporter = getTransport();
    try {
      await transporter.verify();
    } catch (verifyError) {
      console.warn('[mailer] verify SMTP failed, continuo con invio', verifyError);
    }

    const info = await transporter.sendMail({
      from,
      to: input.to,
      subject,
      text: textBody,
      html: htmlBody,
    });

    if (process.env.NODE_ENV !== 'production') {
      console.info('[mailer] payment email sent', info.messageId);
    }

    return { ok: true, messageId: info.messageId };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[mailer] sendOrderPaymentEmail error', error);
    return { ok: false, error: message };
  }
}
