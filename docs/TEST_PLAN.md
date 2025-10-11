# Test plan

## Test e2e manuali
### 1. Checkout email-only (totale 0€)
1. Assicurati che il carrello contenga prodotti gratuiti (`totalCents = 0`).
2. Vai su `/checkout`, compila form con consensi privacy/marketing.
3. Invia → attendi risposta `state: 'confirmed'` e redirect a `/checkout/email-sent`.
4. Apri la mail “Conferma prenotazione” → clicca link (dovrebbe puntare a `/api/bookings/confirm`).
5. Verifica redirect automatico su `/checkout/success?orderId=...&bookingId=...` e che il carrello sia svuotato.
6. Controlla database: `Booking.status = confirmed`, `Order.status = confirmed`, `Cart.status = locked`.

### 2. Checkout con pagamento Revolut (sandbox)
1. Popola carrello con prodotti a pagamento.
2. Completa `/checkout` → ricevi `state: 'verify_sent'` → apri link email di verifica.
3. Dopo redirect a `/checkout?verified=1`, sottometti di nuovo → ricevi `state: 'paid_redirect'` con `hostedPaymentUrl`.
4. Completa il pagamento sandbox (o usa hosted page) → Revolut reindirizza su `/checkout/return?orderId=...`.
5. Attendi polling → redirect `/checkout/success`.
6. Esegui `POST /api/orders/finalize` se necessario e verifica che Booking/Order siano `paid/confirmed`.

### 3. Prenotazione legacy via `/api/bookings`
1. Da `/prenota` (wizard legacy) invia richiesta pranzo con piatti.
2. Verifica email cliente/admin e stato booking `confirmed`.

## Edge case da coprire
- Carrello vuoto → `/checkout` deve mostrare messaggio “Il carrello è vuoto” e bloccare submit.
- Token verifica scaduto → `/api/bookings/confirm` deve reindirizzare a `/checkout/email-sent?error=token_expired` e consentire il reinvio.
- Token riutilizzato → `/api/bookings/confirm` mostra errore e richiede nuovo invio dalla pagina `/checkout/email-sent`.
- Mancanza SMTP → `/api/payments/checkout` deve rispondere `verify_email_failed` (email-only) o `email: { ok: false, skipped: true }` (pagamento) senza crashare.
- Admin non whitelisted → accesso a `/admin` reindirizza a `/admin/not-authorized`.

## Script e richieste di test
### POST /api/payments/checkout
```bash
curl -X POST http://localhost:3000/api/payments/checkout \
  -H 'Content-Type: application/json' \
  --cookie "cart_token=<ID CARRELLO>" \
  -d '{
    "email": "test@example.com",
    "name": "Tester QA",
    "phone": "+39000000000",
    "notes": "Test manuale",
    "agreePrivacy": true,
    "agreeMarketing": false,
    "items": [ { "productId": 1, "quantity": 2 } ]
  }'
```
Risultato atteso: `state: verify_sent | confirmed | paid_redirect` a seconda del totale.

### GET /api/bookings/confirm
```bash
curl -I "http://localhost:3000/api/bookings/confirm?token=<TOKEN>"
```
- 302 → `Location: /checkout/success?...` (email-only confermato).
- 302 → `Location: /checkout?verified=1` + cookie `order_verify_token` (pagamento richiesto via `/api/payments/email-verify`).
- 302 → `Location: /checkout/email-sent?...` (token scaduto/invalidato).

### POST /api/orders/finalize
```bash
curl -X POST http://localhost:3000/api/orders/finalize \
  -H 'Content-Type: application/json' \
  -d '{ "orderId": "ord_xxx" }'
```
Risultato atteso: `{ ok: true, orderId: ... }` e ordine marcato come pagato.

### POST /api/bookings/email-only
```bash
curl -X POST http://localhost:3000/api/bookings/email-only \
  -H 'Content-Type: application/json' \
  -d '{
    "eventSlug": "capodanno-2025",
    "people": 4,
    "customer": { "name": "Tester QA", "email": "qa@example.com", "phone": "+390000000" },
    "agreePrivacy": true,
    "agreeMarketing": true
  }'
```
Risultato atteso: `{ ok: true, bookingId, verificationToken }` e mail inviata.
