# Checkout flow

## Stato condiviso
- Cookie HTTP-only `cart_token`: creato da `/api/cart`, identifica il carrello e viene letto da API checkout.
- Cookie HTTP-only `order_verify_token`: impostato da `/api/payments/email-verify` (solo quando l’email è verificata) e letto da `/api/payments/checkout` per saltare il passaggio di verifica.
- SessionStorage `order_verify_token`: la pagina `/checkout` salva qui il token ricevuto da `POST /api/payments/checkout` (`state: 'verify_sent'`) per mostrarne lo stato.

## Flusso “prenotazione via email” (totale 0€)
```
Cliente ↦ POST /api/payments/checkout
  ├─ verifica consenso privacy obbligatorio
  ├─ cart status → recalc totale = 0 → stato ordine 'pending'
  ├─ issueBookingToken (BookingVerification) + sendBookingVerifyEmail
  └─ risposta { state: 'confirmed', bookingId, orderId, nextUrl }
        (non viene generato token verify lato checkout perché conferma immediata)

Email cliente: link Conferma → GET /api/payments/email-verify?token=...
  ├─ Valida token (consumeBookingToken)
  ├─ Aggiorna Booking.status='confirmed', Order.status='confirmed', Cart.status='locked'
  └─ Redirect a `/checkout/success?orderId=...&bookingId=...` dopo `/api/payments/email-verify`
```
Nel nuovo flusso email-only collegato al carrello (API `email-verify`):
```
POST /api/payments/checkout (totale 0) ─┐
                                       ▼
                       Booking creato/aggiornato + mail verify
                                       ▼
Cliente clicca link email → GET /api/payments/email-verify?token
  ├─ Valida token + carica cart/order
  ├─ Determina se email-only: se `cart.totalCents <= 0` o meta `emailOnly`
  ├─ Aggiorna Booking.status='confirmed', Order.status='confirmed', Cart.status='locked'
  ├─ Invia `sendBookingConfirmedCustomer` + `sendBookingConfirmedAdmin`
  └─ Redirect a `/checkout/success?orderId=...&bookingId=...`
```

## Flusso con pagamento Revolut
```
Cliente compila /checkout → POST /api/payments/checkout
  ├─ Valida carrello e crea/aggiorna Order (status 'pending_payment')
  ├─ Se manca verifyToken, invia mail verify (state 'verify_sent') e termina
  ├─ Se verifyToken valido (cookie + body), continua:
        • Aggiorna consensi marketing
        • Chiama createRevolutOrder → ottiene hostedPaymentUrl e checkoutPublicId
        • Invia sendOrderPaymentEmail (logga esito in paymentRef)
        • Risposta { state: 'paid_redirect', url: hostedPaymentUrl, email: { ok|error } }

Cliente viene reindirizzato da Revolut → /checkout/return?orderId=...
  ├─ Frontend effettua polling GET /api/payments/order-status
  ├─ Se stato `paid/completed` chiama opzionalmente POST /api/orders/finalize (non automatico) e redirect success
  └─ Se `failed/cancelled` mostra errore e invita a riprovare
```

## Stati server
- `verify_sent`: ordine creato, email verifica inviata. Nessuna prenotazione ancora confermata.
- `confirmed`: ordine confermato senza pagamento (email-only). Cart bloccato e booking associato.
- `paid_redirect`: ordine necessita pagamento esterno; risposta include `url` (hosted page) e `checkoutPublicId` per eventuale widget.

## Token e sicurezza
- Token email viene firmato con `signJwt` (`NEXTAUTH_SECRET`) e dura 15 minuti (`VERIFY_TOKEN_TTL_SECONDS`).
- `/api/payments/email-verify` imposta cookie `order_verify_token` valido 15 minuti (httpOnly, `sameSite=lax`), necessario per completare checkout senza reinviare mail.
- SessionStorage viene pulito dal client una volta ricevuto `verified=1` o dopo redirect success.
