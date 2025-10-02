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

type BookingEmailInput = {
  id: number;
  date: string; // ISO
  people: number;
  name: string;
  email: string;
  phone?: string;
  notes?: string;
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
${data.phone ? `• Telefono: ${data.phone}\n` : ''}${data.notes ? `• Note: ${data.notes}\n` : ''}

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
</ul>
<p>In cassa comunica:<br/><em>“Prenotazione a nome ${data.name}, ${data.people} persone, codice #${data.id}”.</em></p>
<p>A presto!<br/>Bar La Soluzione</p>`
  });
  console.log('[mailer] email cliente sent:', r1.messageId);

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
${data.phone ? `Telefono: ${data.phone}\n` : ''}${data.notes ? `Note: ${data.notes}\n` : ''}`
  });
  console.log('[mailer] email admin sent:', r2.messageId);
}
