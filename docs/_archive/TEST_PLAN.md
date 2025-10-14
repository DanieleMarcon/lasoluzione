# Test plan

## Test manuali minimi (pre-deploy)
### 1. Login admin via magic link
1. Apri `https://localhost:3000/admin/signin` (in produzione usare dominio reale).
2. Inserisci un'email presente in `ADMIN_EMAILS`.
3. Verifica che la pagina mostri messaggio di conferma invio link.
4. Recupera l'email dal provider SMTP (Mailtrap/posta reale) e clicca il link.
5. Conferma reindirizzamento a `/admin` senza loop; la sidebar deve mostrare l'indirizzo email e il pulsante "Esci".
6. Tenta l'accesso con un'email non whitelisted → aspettati redirect a `/admin/not-authorized` e nessun utente creato in Prisma (`User`).

### 2. Checkout carrello (totale 0 €)
1. Usa `/prenota` (versione cart) o script `setup-landing-home.js` per aggiungere prodotti gratuiti.
2. Vai su `/checkout`, compila form con consensi privacy/marketing.
3. Invia → verifica risposta `state: 'confirmed'` e redirect a `/checkout/email-sent`.
4. Apri la mail “Conferma prenotazione” → clicca link (punto a `/api/payments/email-verify`).
5. Conferma redirect automatico su `/checkout/success?orderId=...&bookingId=...` e verifica nel DB (`Booking.status = confirmed`).

### 3. Checkout con pagamento (Revolut sandbox)
1. Popola il carrello con prodotti a pagamento (>= 1 €).
2. Compila `/checkout` → ricevi `state: 'verify_sent'` e email di verifica.
3. Dopo il link, reinvia il form: aspettati `state: 'paid_redirect'` con `hostedPaymentUrl`.
4. Completa il pagamento sandbox (o usa `/fake-payment` per simulare) → redirect a `/checkout/return`.
5. Attendi polling → `/checkout/success`. Controlla `Order.status` (`paid` o `confirmed`) e `Cart.status` (`locked`).

### 4. Prenotazione legacy API `/api/bookings`
1. Usa il wizard legacy (flag `NEXT_PUBLIC_CART_ENABLED=false`) oppure invia payload via Postman.
2. Verifica risposta `{ ok: true, data: { bookingId } }` e che venga inviata email a `MAIL_TO_BOOKINGS`.
3. Assicurati che `Booking.type`, `lunchItemsJson` e consensi siano valorizzati.

### 5. Navigazione admin
1. Autenticato, visita tutte le voci di menu: `/admin/bookings`, `/admin/catalog/products`, `/admin/events`, `/admin/contacts`, `/admin/settings`.
2. Verifica caricamento API (`200 OK`) e assenza di errori JavaScript in console.
3. Esegui logout → `signOut` deve riportare a `/admin/signin` e cancellare la sessione.

### 6. Rotte informative
- Controlla `/privacy`, `/cookie-policy`, `/eventi/<slug>` (es. `capodanno-2025`) e `/api/ping` per assicurarsi che il contenuto sia accessibile senza errori.

## Edge case da verificare periodicamente
- Token verifica scaduto: modifica `expiresAt` nel DB → `/api/payments/email-verify` deve restituire 400 e `/checkout` mostrare messaggio di errore con possibilità di reinvio.
- `cart_token` mancante o invalido: cancella il cookie e apri `/checkout` → il client deve rigenerare carrello (`POST /api/cart`).
- SMTP down: spegni il provider → `POST /api/payments/checkout` deve restituire `verify_email_failed` senza crash.
- Rotte admin inaccessibili senza sessione: apri `/admin` in incognito → redirect a `/admin/signin?from=/admin`.

## Idee per test automatizzati
### Playwright (E2E)
- **Scenario login admin**: mock provider SMTP (MailSlurp/API) per intercettare link, testare login end-to-end e accesso a `/admin/bookings`.
- **Checkout free order**: popola carrello via API (`POST /api/cart`), esegui flow email-only verificando redirect finali e contenuto pagina di successo.
- **Checkout pagato**: usa `/fake-payment` per simulare `POST /api/bookings/fake-confirm` e validare l'aggiornamento UI.
- **Rotte protette**: verifica che `/admin/*` restituisca 307 → `/admin/signin` per utenti anonimi.

### Unit / Integration (Vitest o Jest)
- **`isAdminEmail`**: testare parsing di `ADMIN_EMAILS` (case insensitive, separatori multipli).
- **Validatori Zod**: importare schemi da API checkout/booking per garantire che payload invalidi vengano rifiutati.
- **`ensureCart`** (`src/lib/cart.ts`): mock Prisma e testare creazione/riapertura carrello.
- **`src/lib/auth.ts` callbacks**: usare `vi.fn()` per confermare che utenti non whitelisted vengano eliminati.
- **Seed**: eseguire `prisma/seed.ts` in database temporaneo e verificare che generi almeno una sezione e un evento (`serata-capodanno`).

## Checklist QA rapida
- [ ] Healthcheck `/api/ping` risponde 200 in <200ms.
- [ ] Magic link ricevuto e login completato.
- [ ] Prenotazione zero € completata e email inviata.
- [ ] Ordine a pagamento restituisce `hostedPaymentUrl` funzionante.
- [ ] Rotte admin principali restituiscono contenuti (200) e nessun errore in console.
