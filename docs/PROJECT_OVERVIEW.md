---
merged_from:
  - README.md
updated: 2025-02-14
---
# Panoramica progetto & setup rapido

> Questo documento sostituisce il precedente `README.md` in root. Fornisce panoramica, prerequisiti e flussi chiave. Per un indice completo consultare `README.md`.


Sito e piattaforma operativa per il bar "La Soluzione". L'app Next.js 14 gestisce:
- landing marketing e contenuti statici;
- flusso prenotazioni legacy e catalogo con carrello/checkout;
- area amministratore protetta con magic link email (NextAuth v5 + Prisma Adapter);
- API serverless (App Router) collegate a PostgreSQL su Supabase e servizi email/checkout.

## Stack tecnico sintetico
- **Framework**: Next.js 14.2.33 (App Router, runtime Node.js).
- **Linguaggi**: TypeScript 5.9, React 18.3.
- **Package manager**: pnpm 10 (lockfile `pnpm-lock.yaml`).
- **Auth**: NextAuth v5.0.0-beta.29 email provider, `@auth/prisma-adapter` 2.10.0, sessione JWT.
- **Database**: PostgreSQL (Supabase) gestito con Prisma 6.17.1 (`prisma/schema.prisma`, migrazioni in `prisma/migrations`).
- **UI/State**: Tailwind CSS 4.1.x, framer-motion 11, react-hook-form 7, zustand 4, zod 3.
- **Email/Checkout**: Nodemailer, infrastruttura SMTP configurabile, Revolut Checkout SDK/hosted.

## Requisiti
- Node.js `>=20 <21` (usare la versione LTS 20.x).
- pnpm `>=10` (allineato al campo `packageManager`).
- Database PostgreSQL raggiungibile (in locale è ammesso Supabase o Postgres Docker).
- Variabili d'ambiente valorizzate (`.env.local`) con credenziali NextAuth, SMTP e database.

## Setup locale passo-passo
1. **Clona** il repository e posizionati nella cartella di lavoro.
   ```bash
   git clone <repo-url>
   cd lasoluzione
   ```
2. **Installa le dipendenze** con pnpm.
   ```bash
   pnpm install
   ```
3. **Configura le variabili d'ambiente** copiando il template e aggiornando i valori.
   ```bash
   cp docs/.env.example .env.local
   ```
   Compila almeno: `DATABASE_URL` (Postgres locale), `DIRECT_URL` (opzionale ma consigliato per CLI), `NEXTAUTH_SECRET`, `NEXTAUTH_URL` (es. `http://localhost:3000`), `AUTH_URL` (uguale a `NEXTAUTH_URL`), credenziali SMTP (anche sandbox come Mailtrap) e `ADMIN_EMAILS`.
4. **Applica le migrazioni Prisma** sull'ambiente locale.
   ```bash
   pnpm prisma migrate dev
   ```
5. **Popola i dati di esempio**.
   ```bash
   pnpm tsx prisma/seed.ts
   ```
   Output atteso (estratto):
   - `[seed] Creati/aggiornati <n> utenti admin`
   - `[seed] Catalogo piatti pranzo aggiornato`
   - `[seed] Event tiers aggiornati`
   - `[seed] Sections ok`
   - `[seed] EventInstance singolo Capodanno pronto`
6. **Avvia il server di sviluppo**.
   ```bash
   pnpm dev
   ```
   L'app è disponibile su <http://localhost:3000>. Il magic link email verrà inviato tramite il provider SMTP configurato (in sandbox puoi leggere il log nel provider o nella console).

> Consulta `DEVOPS.md` per la descrizione completa delle variabili e la matrice Local/Preview/Production.

## Script utili
- `pnpm dev` – Next.js in sviluppo.
- `pnpm build` – build di produzione.
- `pnpm start` – avvia la build compilata.
- `pnpm lint` – esegue ESLint.
- `pnpm prisma:fmt` – format schema Prisma.
- `pnpm prisma:gen` – genera il client Prisma (rispetta `prisma.config.ts`).
- `pnpm prisma:migrate` – scorciatoia locale (`prisma migrate dev --name ensure_event_item`).
- `pnpm prisma:studio` – apre Prisma Studio.
- `pnpm tsx prisma/seed.ts` – seed completo (non distruttivo).
- `pnpm seed:single-event` – re-esegue solo lo seed principale (`prisma/seed.ts`).
- `pnpm backfill:events` – script custom in `scripts/backfill-events.ts` per riallineare eventi.

## Flussi chiave
### Login email magic link
- Configurazione in `src/lib/auth.ts`: provider email con SMTP, whitelist admin tramite `isAdminEmail`.
- Richiesta link da `/admin/signin` → invia email; callback `signIn` blocca utenti non whitelisted e fa cleanup.
- Middleware (`src/middleware.ts`, matcher `/admin/:path*`) verifica il JWT; utenti non autenticati vengono reindirizzati a `/admin/signin?from=...`.
- Dopo il login la sessione JWT include `user.role = 'admin'` e viene fornita al layout tramite `AdminProviders`.

### Area admin protetta
- Layout server (`src/app/admin/(protected)/layout.tsx`) chiama `auth()` e passa `session` a `AdminProviders` e `userEmail` a `AdminNav`.
- Nav gestisce sezioni (Catalogo, CRM) e logout con `signOut({ callbackUrl: '/admin/signin' })`.
- Tutte le pagine `/admin/*` consumano API in `src/app/api/admin/*` protette dallo stesso middleware.

### Prenotazioni e booking legacy
- `/prenota` offre wizard legacy o catalogo+carrello in base a feature flag (`NEXT_PUBLIC_CART_ENABLED`).
- Prenotazioni legacy invocano `POST /api/bookings` con struttura storica (date, piatti, consensi) e alimentano `Booking` + email amministrazione (`MAIL_TO_BOOKINGS`).
- Configurazioni generali in `BookingSettings` (`prisma/seed.ts` imposta cover/prepay, tipologie, flag).

### Carrello e checkout
- Carrello persistito via cookie `cart_token` (`/api/cart` GET/POST) con snapshot prodotto (`CartItem`).
- Checkout (`/checkout`) invoca `POST /api/payments/checkout` → casi:
  - totale `0`: conferma immediata + email-only;
  - totale `>0`: invia magic link verifica ordine (`bookingVerification`) e genera `hostedPaymentUrl` Revolut.
- Endpoint ausiliari: `/checkout/email-sent`, `/checkout/return`, `/checkout/cancel`, `/checkout/success` per i vari step; `/fake-payment` supporta test.
- `Order` e `Booking` vengono aggiornati tramite webhook-like poll `/api/payments/order-status` o finalize manuale `POST /api/orders/finalize`.

## Dipendenze critiche
| Pacchetto | Versione | Uso |
| --- | --- | --- |
| `next` | 14.2.33 | App Router, server actions |
| `react` / `react-dom` | 18.3.1 | Rendering UI |
| `next-auth` | 5.0.0-beta.29 | Auth email magic link |
| `@auth/prisma-adapter` | 2.10.0 | Persistenza utenti/sessioni |
| `prisma` / `@prisma/client` | 6.17.1 | ORM PostgreSQL, migrazioni |
| `tailwindcss` | 4.1.14 | Stili utility (combinato con CSS custom) |
| `zod` | ^3.25.76 | Validazione payload API |
| `react-hook-form` | ^7.63.0 | Form checkout e admin |
| `zustand` | ^4.5.7 | Stato client (carrello, UI) |
| `nodemailer` | 6.10.1 | Invio email Auth e notifiche |
| `@revolut/checkout` | 1.1.23 | Integrazione pagamenti |

## Troubleshooting rapido
- **Errore NextAuth `Configuration`**: verifica `NEXTAUTH_URL`, `AUTH_URL`, `NEXTAUTH_SECRET`, SMTP (`SMTP_HOST/PORT/USER/PASS`, `MAIL_FROM`). Rigenera la secret (`openssl rand -base64 32`) e riavvia.
- **Redirect errato (www ↔ apex)**: su Vercel assicurarsi che il dominio primario sia `https://www.lasoluzione.eu` o `https://lasoluzione.eu` in base alla configurazione desiderata, impostando redirect 301 per l'altro e aggiornando `NEXTAUTH_URL`/`AUTH_URL` coerenti.
- **`ERR_PNPM_OUTDATED_LOCKFILE`**: il repo usa pnpm 10 → aggiorna pnpm (`corepack enable pnpm@10`), elimina eventuale `package-lock.json` locale e riesegui `pnpm install`.
- **Prisma `P3019 provider mismatch`**: indica che il database attivo non è PostgreSQL. Controlla `DATABASE_URL`/`DIRECT_URL` (Supabase, formato `postgresql://...`) e che eventuali residui SQLite non vengano caricati.
- **Magic link non arriva**: controlla i log SMTP, verifica `ADMIN_EMAILS` (case insensitive) e prova l'endpoint debug `/api/admin/_whoami` in sviluppo per confermare env/token.

## Rischi & To-Do
### Priorità Alta
- Verificare in produzione che `NEXTAUTH_URL`, `AUTH_URL` e `NEXT_PUBLIC_SITE_URL` puntino al dominio definitivo (no URL di anteprima Vercel) per evitare link invalidi.
- Stabilire backup automatici del database Supabase/PostgreSQL (snapshot giornalieri) e procedure di ripristino documentate.
- Monitorare i log SMTP e gli errori Revolut: in caso di fallimenti ripetuti aggiungere alerting.

### Priorità Media
- Abilitare HTTPS forced redirect + HSTS su entrambi i domini (`lasoluzione.eu`, `www.lasoluzione.eu`).
- Implementare rate limiting sugli endpoint `/api/bookings` e `/api/auth/*` (attualmente assente) o proteggere tramite reverse proxy.
- Automatizzare test end-to-end (Playwright) per login admin e checkout per ridurre regressioni manuali.

### Priorità Bassa
- Valutare CSP dedicata e impostazioni avanzate di sicurezza (es. `content-security-policy`, `permissions-policy`).
- Audit periodico delle whitelist `ADMIN_EMAILS` e cleanup utenti non autorizzati rimasti nel database.
- Consolidare feature flag frontend (`NEXT_PUBLIC_CART_ENABLED`, `NEXT_PUBLIC_ADMIN_SHOW_LEGACY`) in una matrice di configurazione centralizzata.

## Documentazione correlata
- [DEVOPS.md](./DEVOPS.md)
- [FRONTEND.md](./FRONTEND.md)
- [BACKEND.md](./BACKEND.md)
- [PAYMENTS.md](./PAYMENTS.md)
- [BOOKING_EMAIL_ONLY.md](./BOOKING_EMAIL_ONLY.md)
- [CART_NOTES.md](./CART_NOTES.md)
- [TESTING.md](./TESTING.md)
- [CHANGELOG.md](./CHANGELOG.md)

## Cronologia merge
- Contenuto originale: `README.md` (ottobre 2025).
