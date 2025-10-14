# Troubleshooting

| Problema | Sintomi | Fix immediato |
| --- | --- | --- |
| Tailwind non applica gli stili | Nessun stile custom, classi `text-slate-*` ignorate | Verifica `tailwind.config.ts` e `postcss.config.mjs`. Assicurati che `postcss` usi `@tailwindcss/postcss` e che `globals.css` importi `@tailwind base/components/utilities`. Riavvia `pnpm dev` dopo modifiche |
| Errore `NEXTAUTH_SECRET` mancante | Build/dev crasha con `Missing NEXTAUTH_SECRET` | Definisci `NEXTAUTH_SECRET` in `.env.local` (almeno 32 caratteri) e riavvia. In produzione imposta anche `NEXTAUTH_URL` |
| Login admin restituisce 500 | Auth.js non riesce a inviare email | Controlla credenziali SMTP (`SMTP_*`, `MAIL_FROM`). Usa Mailtrap per test. Verifica anche che `ADMIN_EMAILS` contenga l’indirizzo |
| Email checkout non partono | Log `[mailer] ... skipped (SMTP non configurato)` | Configura SMTP o accetta comportamento log-only; per verificare flusso email-only usa `/api/payments/checkout` e osserva la risposta (`email.ok`) |
| `/checkout` bloccato in stato `pending` | Cookie `order_verify_token` presente ma non valido | Cancella sessionStorage `order_verify_token` e cookie HTTP (via devtools) poi ripeti il checkout; assicurati che il link email usi lo stesso browser |
| Poll `/checkout/return` infinito | Stato ordine non aggiornato | Verifica su console se `parsePaymentRef` contiene `emailError`. Se pagamento completato su Revolut, chiama `POST /api/orders/finalize` manualmente o riprova dopo alcuni secondi |
| DB SQLite bloccato (file .db-journal/.db-wal presenti) | Prisma errori `SQLITE_BUSY` | Chiudi processi che usano il DB (`pnpm dev`), cancella file `prisma/dev.db*` e rilancia `pnpm prisma db push` |
| Carrello resettato ad ogni refresh | LocalStorage/token mancanti | Controlla che il dominio consenta LocalStorage (no modalità incognito restrittiva). Se serve forzare token, effettua `POST /api/cart` con `{ token: "..." }` |
| Admin whitelist non funziona | Utente reindirizzato a `/admin/not-authorized` | Normalizza email in `ADMIN_EMAILS` (lowercase, senza spazi). Verifica che il magic link arrivi all’indirizzo corretto |
