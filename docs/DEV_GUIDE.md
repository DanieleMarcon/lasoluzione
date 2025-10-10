# Guida sviluppo

## Onboarding rapido
1. **Prerequisiti**: Node 20+, pnpm 9+, SQLite (gestito via Prisma), accesso a Mailtrap/Revolut sandbox.
2. `pnpm install`
3. `cp .env.example .env.local` e aggiorna secret/auth/SMTP/Revolut.
4. `pnpm prisma db push` + `pnpm tsx prisma/seed.ts` per popolare dati demo.
5. `pnpm dev` → http://localhost:3000.

## Struttura repository
- `src/app` — App Router (UI pubblica, checkout, admin, API). Cartelle `api/**` seguono lo stesso path della rotta.
- `src/components` — componenti condivisi (cart, booking wizard, admin UI).
- `src/hooks` — hook client (`useCart`).
- `src/lib` — layer dominio (Prisma, mailer, Revolut, JWT, logger, paymentRef, bookingVerification, cookies, ecc.).
- `src/state` — store Zustand per consenso cookie.
- `prisma` — schema, migrations, seed.

## Convenzioni
- **Commit**: formato libero ma preferire `feat:`, `fix:`, `docs:` quando possibile.
- **TypeScript**: evitare `any` se non strettamente necessario; preferire DTO (`src/types/**`).
- **API**: restituire sempre `{ ok: boolean }` + `error` string per uniformità.
- **Email-only**: usare terminologia “prenotazione via email” in UI e documenti.

## Debugging
- **Storage**: in Chrome DevTools → Application → Storage
  - Cookies: `cart_token`, `order_verify_token` (httpOnly → ispezionabili via Application → Cookies).
  - SessionStorage: chiave `order_verify_token` (solo lato client).
  - LocalStorage: `lasoluzione_cart_token` (token carrello usato da `useCart`).
- **Log server**: `logger.*` stampa JSON (maschera email); controlla `emailError` dentro `paymentRef` per esito invio pagamento.
- **SMTP**: usa Mailtrap/smtp4dev e monitora l’inbox per verificare template.
- **Revolut sandbox**: se vuoi forzare stati, puoi usare il fake payment `/fake-payment?token=...` su prenotazioni legacy.

## Simulare stati
- **Forzare verifica email**: recupera token `order_verify_token` dal cookie (solo via server) oppure genera un nuovo link chiamando `POST /api/payments/checkout` con payload valido (verrà re-inviata la mail).
- **Prenotazione email-only manuale**: usa `POST /api/bookings/email-only` con `eventSlug`, `people` e consensi; controlla la mail di verifica e apri il link.
- **Ordine pagato**: dopo aver completato il pagamento sandbox, chiama `POST /api/orders/finalize` con `orderId` per simulare conferma lato dominio.

## Testing manuale
- Checkout → completare i tre rami: `verify_sent` (senza conferma), `confirmed` (email-only), `paid_redirect` (pagamento).
- Admin → verifica che il middleware reindirizzi utenti non whitelisted su `/admin/not-authorized`.
- Consent banner → prova toggle categorie e verifica cookie `lasoluzione_cookie_consent`.

## Accesso admin
- Popola `ADMIN_EMAILS` con il tuo indirizzo.
- Richiedi magic link da `/admin/signin` (necessita SMTP funzionante). Il middleware `src/middleware.ts` blocca anche le API `/api/admin/*`.
