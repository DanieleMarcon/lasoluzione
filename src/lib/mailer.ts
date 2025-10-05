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

export function getTransport() {
  if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS || !MAIL_FROM) {
    throw new Error(
      'SMTP env vars mancanti: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, MAIL_FROM'
    );
  }
  const port = Number(SMTP_PORT);

  const transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS }
  });

  return transporter;
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
