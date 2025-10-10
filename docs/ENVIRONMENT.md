# Variabili d'ambiente

| Nome | Obbligatorio | Default/Esempio | Descrizione |
| --- | --- | --- | --- |
| `NEXT_PUBLIC_BASE_URL` | Consigliato | `http://localhost:3000` | URL pubblico usato in email, redirect checkout e link verifiche |
| `APP_BASE_URL` | Opzionale | — | Override server-side per link (fallback a `NEXT_PUBLIC_BASE_URL`) |
| `BASE_URL` | Opzionale | — | Ulteriore fallback legacy per link email |
| `NEXT_PUBLIC_SITE_URL` | Opzionale | `http://localhost:3000` | Base per `sitemap.ts` |
| `NEXT_PUBLIC_APP_URL` | Opzionale | — | Utilizzato da `/admin/tiers` per generare URL assoluti |
| `NEXT_PUBLIC_CART_ENABLED` | Opzionale | `false` | Se `true` attiva UI carrello in `/prenota` |
| `NEXT_PUBLIC_ADMIN_SHOW_LEGACY` | Opzionale | `false` | Mostra link area legacy nella navigation admin |
| `NEXT_PUBLIC_CONSENT_DEBUG` | Opzionale | `0` | Se `1` forza la visualizzazione del banner cookie |
| `NEXT_PUBLIC_POLICY_VERSION` | Opzionale | `1.0.0` | Versionamento consenso cookie + testo policy |
| `NEXT_PUBLIC_MAPS_EMBED_URL` | Opzionale | — | URL iframe mappa (fallback statico se assente) |
| `DATABASE_URL` | **Sì** | `file:./dev.db` | Connessione Prisma; necessario per pagine evento dinamiche |
| `NEXTAUTH_SECRET` | **Sì** | generare stringa random | Secret JWT per NextAuth, richiesto da middleware e API checkout |
| `NEXTAUTH_URL` | Produzione | `https://app.example.com` | URL base usato da NextAuth per generare link magic |
| `ADMIN_EMAILS` | **Sì** in prod | `user@example.com,user2@example.com` | Whitelist email amministratori |
| `SMTP_HOST` | Dev opzionale | `smtp.mailtrap.io` | Host SMTP per invio email (Auth.js + mailer) |
| `SMTP_PORT` | Dev opzionale | `587` | Porta SMTP |
| `SMTP_USER` | Dev opzionale | `user` | Credenziali SMTP |
| `SMTP_PASS` | Dev opzionale | `pass` | Credenziali SMTP |
| `MAIL_FROM` | Dev opzionale | `"La Soluzione <noreply@lasoluzione.it>"` | Mittente email (Auth.js + mailer) |
| `MAIL_TO_BOOKINGS` | Consigliato | `info@lasoluzione.eu` | Destinatario notifiche admin booking |
| `REVOLUT_SECRET_KEY` | Necessario per pagamenti | `sk_test_xxx` | API key merchant per chiamate server `createRevolutOrder` |
| `REVOLUT_API_VERSION` | Necessario per pagamenti | `2024-09-01` | Versione API inviata negli header |
| `REVOLUT_API_BASE` | Opzionale | `https://sandbox-merchant.revolut.com` | Override host API (default sandbox/live in base a `REVOLUT_ENV`) |
| `REVOLUT_ENV` | Opzionale | `sandbox` | Forza host API lato server se diverso da default |
| `NEXT_PUBLIC_REVOLUT_ENV` | Consigliato | `sandbox` | Modalità SDK client (`sandbox`/`prod`) |
| `NEXT_PUBLIC_REVOLUT_PUBLIC_KEY` | Necessario per widget embedded | `pk_test_xxx` | Token pubblico per inizializzare RevolutCheckout; se assente il flow usa hosted page |
| `PAY_RETURN_URL` | Opzionale | `http://localhost:3000/checkout/return` | URL redirect successo pagamento |
| `PAY_CANCEL_URL` | Opzionale | `http://localhost:3000/checkout/cancel` | URL redirect annullamento |

## Setup minimo sviluppo
1. Copia `.env.example` in `.env.local` e aggiorna:
   - `NEXT_PUBLIC_BASE_URL`
   - `DATABASE_URL` (es. `file:./dev.db`)
   - `NEXTAUTH_SECRET`
   - Credenziali SMTP finte (Mailtrap o `smtp4dev`) **oppure** lascia i valori di esempio per log-only.
   - Chiavi Revolut sandbox (`NEXT_PUBLIC_REVOLUT_PUBLIC_KEY`, `REVOLUT_SECRET_KEY`).
2. Esegui `pnpm prisma db push` per generare il DB SQLite.
3. Avvia `pnpm dev`.

### SMTP fake
Se mancano le variabili SMTP, il mailer non invia email ma logga un avviso (`[mailer] ... skipped`). Utile in locale ma ricorda che Auth.js richiede comunque credenziali valide per generare link login; in assenza il boot solleverà un errore da `src/lib/auth.ts`.

### NEXTAUTH_URL e produzione
- In locale può essere omesso se usi `http://localhost:3000`.
- In produzione deve puntare al dominio pubblico altrimenti i link magic risultano invalidi.

### Base URL per email/redirect
Ordine delle priorità lato server: `NEXT_PUBLIC_BASE_URL` → `APP_BASE_URL` → `BASE_URL`. Imposta almeno una delle tre variabili per generare link corretti in email checkout/prenotazioni.
