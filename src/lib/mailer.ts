// src/lib/mailer.ts
import nodemailer from 'nodemailer';

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
