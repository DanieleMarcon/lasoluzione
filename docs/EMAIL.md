# Email & notifiche

## Trasporto
- Implementato con `nodemailer` in `src/lib/mailer.ts`.
- Richiede variabili `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.
- `getTransport()` crea un singleton; se la config manca viene sollevato errore (usato da Auth.js).
- Funzioni che inviano email verificano `hasSmtpConfig()`: se `false` loggano `[mailer] ... skipped` e ritornano `{ ok: false, skipped: true }` senza lanciare eccezioni.

## Template e trigger principali
| Funzione | Trigger | Destinatario | Contenuto |
| --- | --- | --- | --- |
| `sendOrderEmailVerifyLink({ to, name, verifyUrl })` | POST `/api/payments/checkout` (totale > 0 e email non ancora verificata) | Cliente | Email con link di verifica (`verifyUrl` → `/api/payments/email-verify`) |
| `sendBookingVerifyEmail({ to, bookingId, token, eventTitle, whenLabel, baseUrl })` | Checkout email-only (`totalCents <= 0`) oppure `/api/bookings/email-only` | Cliente | Mail con bottone “Conferma prenotazione” che chiama `/api/bookings/confirm?token=...` |
| `sendBookingConfirmedCustomer` | `/api/payments/email-verify` quando conferma email-only | Cliente | Conferma prenotazione con riepilogo persone/evento |
| `sendBookingConfirmedAdmin` | `/api/payments/email-verify` (email-only) | Admin (`MAIL_TO_BOOKINGS`) | Avviso prenotazione confermata |
| `sendOrderPaymentEmail({ to, orderId, amountCents, hostedPaymentUrl })` | Checkout con importo > 0 dopo creazione ordine Revolut | Cliente | Invita a completare pagamento (bottone + link fallback). Salva esito in `paymentRef` |
| `sendBookingEmails()` | POST `/api/bookings` legacy | Cliente + Admin | Set di template legacy (richiesta, pending, confirmed) |
| `bookingRequestCustomer`, `bookingPendingAdmin`, ecc. | Funzioni legacy invocate da `sendBookingEmails` | Cliente/Admin | Coprono casi pranzo/cena legacy |
| Auth.js provider email | /api/auth magic link | Admin che richiede login | Usa template predefinito NextAuth (via SMTP) |

## Dipendenze e fallback
- `MAIL_TO_BOOKINGS` deve essere valorizzato per ricevere notifiche admin; se vuoto i tentativi falliscono con log di warning.
- In sviluppo, senza SMTP reale, utilizzare Mailtrap / smtp4dev per catturare i messaggi.
- Il sistema non implementa code o retry: eventuali errori vengono loggati ma non ripetuti automaticamente.

## Comportamento senza credenziali
- Checkout email-only fallisce se `sendBookingVerifyEmail` lancia (es. credenziali errate) → API ritorna `500 verify_email_failed`.
- Checkout pagamento: se `sendOrderPaymentEmail` fallisce, l’ordine rimane valido (`pending_payment`) ma `paymentRef` conserva `emailError` per diagnostica; la risposta include `{ email: { ok: false, error } }`.
- Auth.js: senza SMTP l’app crasha in fase di import `src/lib/auth.ts` (hard fail per sicurezza).
