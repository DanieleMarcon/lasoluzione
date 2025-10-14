---
merged_from:
  - docs/BUILD_AND_DEPLOY.md
  - docs/ENVIRONMENT.md
  - docs/SECURITY.md
  - docs/TROUBLESHOOTING.md
  - OPERATIONS.md
updated: 2025-02-14
---
# DevOps, Ambiente & Sicurezza Operativa

> Questo documento sostituisce `docs/BUILD_AND_DEPLOY.md`, `docs/ENVIRONMENT.md`, `docs/SECURITY.md`, `docs/TROUBLESHOOTING.md` e `OPERATIONS.md`. Riunisce informazioni su ambienti, deploy, sicurezza e runbook operativi.

## Build & Deploy (Vercel)

## Pipeline
- **Repository principale** → branch `main` deploya in produzione su Vercel.
- Ogni branch crea un **Preview Deployment** (`https://<branch>-lasoluzione.vercel.app`).
- Runtime configurato da `package.json` → `engines.node ">=20 <21"`; Vercel sceglierà Node.js 20.
- Package manager: `pnpm@10.0.0` (`packageManager`). Assicurarsi che Vercel usi pnpm (`ENABLE_EXPERIMENTAL_COREPACK=1` è implicito).
- Build command default (`vercel`): `pnpm install` → `pnpm build`. Il postinstall esegue `prisma generate` a meno che `SKIP_PRISMA_GENERATE=1`.
- Output Next.js App Router (serverless/edge) → nessuna configurazione custom di build directory.

### Variabili d'ambiente in Vercel
- Imposta tutte le variabili elencate in `DEVOPS.md` nelle tre sezioni `Production`, `Preview`, `Development`.
- Non utilizzare URL di anteprima per `NEXTAUTH_URL`, `AUTH_URL`, `NEXT_PUBLIC_SITE_URL` in produzione: devono puntare al dominio reale (`https://www.lasoluzione.eu`).
- `DIRECT_URL` è obbligatoria in ambienti dove girano migrazioni (`vercel deploy --prebuilt` non le esegue). Assicurarsi che punti alla porta 5432 di Supabase.
- Per velocizzare i preview senza auth, puoi omettere `NEXTAUTH_URL` ma lasciare `MAIL_FROM`/`SMTP_*` impostati su provider sandbox.

### Gestione lockfile
- Il progetto mantiene `pnpm-lock.yaml` in root. Non committare `package-lock.json` (presente solo per retrocompatibilità, non usato).
- Errore `ERR_PNPM_OUTDATED_LOCKFILE`: aggiorna l'agente di build a pnpm 10 oppure rigenera il lock (`pnpm install --lockfile-only`).

### Skip build opzionale
- Per saltare la build (es. deploy documentazione) su Vercel puoi impostare la variabile temporanea `SKIP_BUILD=1` prima del deploy (`vercel env pull` + `vercel --force --prebuilt`), oppure usare `vercel.json` con `ignoredBuildStep`. Attualmente non è configurato.

## DNS & domini
- Dominio primario: `www.lasoluzione.eu` (CNAME verso `cname.vercel-dns.com`).
- Dominio apex: `lasoluzione.eu` → configura record ALIAS/ANAME oppure A verso gli IP Vercel (vedi [Vercel docs](https://vercel.com/docs/internals/ip-addresses); aggiornare se Vercel rilascia nuovi IP). Imposta redirect 301 verso `https://www.lasoluzione.eu` in Vercel Domain Settings.
- Abilita HTTPS automatico (Let's Encrypt). Dopo la verifica, abilita HSTS (Strict-Transport-Security) con max-age >= 31536000 (includeSubDomains opzionale).
- Evita configurazioni miste (www ↔ apex) nelle variabili `NEXTAUTH_URL`/`AUTH_URL`: scegli un dominio e mantienilo coerente.

## Deploy checklist
1. `pnpm test` (quando disponibile) o almeno lint/TypeScript: `pnpm lint` (opzionale ma consigliato).
2. `pnpm prisma migrate diff --from-empty --to-schema-datamodel` (se cambi schema) per verificare la migrazione.
3. `pnpm prisma generate` locale per assicurarsi che il client sia aggiornato.
4. Commit + push su branch → verifica Preview su Vercel.
5. Controlla i log di build su Vercel: nessun warning `NEXTAUTH_SECRET missing` o errori Prisma.
6. Promuovi la preview a produzione (`vercel promote` oppure merge in `main`).

## Post-deploy smoke test
Eseguire subito dopo ogni deploy (produzione):
1. **Healthcheck** → `curl https://www.lasoluzione.eu/api/ping` (attende `{ ok: true }`).
2. **Sessione Auth** → `curl -I https://www.lasoluzione.eu/api/auth/session` (risposta 200 + header `set-cookie=next-auth.session-token` se autenticato). In alternativa usa browser con utente admin.
3. **Login admin** → visita `https://www.lasoluzione.eu/admin/signin`, richiedi magic link, verifica che l'email arrivi e che l'accesso a `/admin` funzioni.
4. **Catalogo/checkout** → aggiungi un prodotto demo dal sito, completa `/checkout` con totale zero (email-only) e verifica redirect a `/checkout/success`.
5. **API Revolut** → su ordine a pagamento controlla che `POST /api/payments/checkout` ritorni `state: 'paid_redirect'` con `hostedPaymentUrl` valido.
6. **Log Vercel** → monitora per 5-10 minuti eventuali errori (`NEXTAUTH Configuration`, `PrismaClientInitializationError`).

## Rollback
- Usa `vercel --prod --target <deployment-id>` per ritornare a una preview precedente.
- Ripristina database tramite backup (`pg_restore`) prima di ripromuovere un deploy precedente se le migrazioni hanno introdotto cambi schema.

## Monitoraggio post-deploy
- Configura alert su Supabase per errori query e saturazione connessioni.
- Aggiungi monitor HTTP (Upptime, Better Stack) su `/api/ping` e `/checkout`.
- Verifica periodicamente la pagina `/api/admin/_whoami` in staging per confermare che i secrets restino corretti dopo rotazioni.

## Ambiente & variabili

## Requisiti runtime
- **Node.js**: `>=20 <21` (consigliato 20.x LTS). Configura `engines` coerente anche su Vercel/CI.
- **pnpm**: `>=10` (usa `corepack enable pnpm@10`).
- **Database**: PostgreSQL gestito (Supabase in produzione). Per CLI Prisma è consigliato impostare `DIRECT_URL` verso la porta 5432 non proxy.

## Matrice ambienti
| Ambiente | Dominio pubblico | NEXTAUTH_URL / AUTH_URL | Note |
| --- | --- | --- | --- |
| **Local** | `http://localhost:3000` | `http://localhost:3000` | Usa `.env.local`, SMTP sandbox (Mailtrap / smtp4dev), `DATABASE_URL` verso Postgres locale o Supabase `.supabase.co`. |
| **Preview (Vercel)** | `https://<branch>-lasoluzione.vercel.app` | Lasciare vuoto per evitare link errati. Impostare `AUTH_URL` solo se si desidera testare login (sconsigliato). | Popola `DATABASE_URL`/`DIRECT_URL` con un database di staging e credenziali SMTP dedicate. Evita di riutilizzare Supabase di produzione. |
| **Production (Vercel)** | `https://www.lasoluzione.eu` (primario) e redirect 301 da `https://lasoluzione.eu` | Entrambi **devono** essere `https://www.lasoluzione.eu` (o l'apex se preferito) per NextAuth. Nessun URL di anteprima. | Configura domini personalizzati in Vercel: `www.lasoluzione.eu` come Primary Domain, `lasoluzione.eu` come redirect → `https://www.lasoluzione.eu`. Aggiorna record DNS (CNAME verso `cname.vercel-dns.com`). |

> In produzione `NEXTAUTH_URL`, `AUTH_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_BASE_URL` e `APP_BASE_URL` devono combaciare con il dominio effettivo. Non usare URL di anteprima nelle variabili segrete di produzione.

## Template `.env.example`
> Copia questo file in `.env.local` per lo sviluppo. I valori tra `<...>` vanno sostituiti.

```env
# --- Applicazione ---
NEXT_PUBLIC_SITE_URL=https://www.lasoluzione.eu     # Sovrascrivi in locale se necessario
NEXT_PUBLIC_BASE_URL=http://localhost:3000          # URL usato nelle email lato server
APP_BASE_URL=                                       # Override server-side opzionale
BASE_URL=                                           # Fallback legacy
NEXT_PUBLIC_APP_URL=                                # URL assoluto per generazione link admin

# Feature flag frontend
NEXT_PUBLIC_CART_ENABLED=false                     # true per mostrare il carrello nel wizard
NEXT_PUBLIC_ADMIN_SHOW_LEGACY=false                # true per linkare viste legacy admin
NEXT_PUBLIC_CONSENT_DEBUG=0                        # 1 forza banner cookie
NEXT_PUBLIC_POLICY_VERSION=1.0.0                   # versioning consenso cookie
NEXT_PUBLIC_MAPS_EMBED_URL=                        # iframe mappa personalizzato

# --- NextAuth / Auth.js ---
NEXTAUTH_URL=http://localhost:3000                 # In prod: https://www.lasoluzione.eu
AUTH_URL=http://localhost:3000                     # Usato da Auth.js per generare link (mantieni uguale a NEXTAUTH_URL)
NEXTAUTH_SECRET=<genera-stringa-32+>
ADMIN_EMAILS=admin@lasoluzione.eu,staff@lasoluzione.eu

# SMTP provider per magic link e notifiche
MAIL_FROM="La Soluzione <noreply@lasoluzione.eu>"
SMTP_HOST=<smtp.host>
SMTP_PORT=465                                       # 465 = TLS implicito; usa 587 per STARTTLS
SMTP_USER=<smtp-user>
SMTP_PASS=<smtp-pass>

# Destinatari notifiche booking
BOOKING_ADMIN_EMAIL=info@lasoluzione.eu            # opzionale, legacy
MAIL_TO_BOOKINGS=info@lasoluzione.eu               # lista separata da virgole

# --- Database Prisma ---
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/postgres?schema=public
DIRECT_URL=postgresql://USER:PASSWORD@HOST:PORT/postgres?schema=public   # Connessione diretta per CLI (Supabase 5432)

# --- Pagamenti Revolut ---
NEXT_PUBLIC_REVOLUT_ENV=sandbox
NEXT_PUBLIC_REVOLUT_PUBLIC_KEY=<pk_test_xxx>
REVOLUT_SECRET_KEY=<sk_test_xxx>
REVOLUT_API_VERSION=2024-10-01
REVOLUT_API_BASE=                                   # opzionale override host API
REVOLUT_ENV=sandbox                                 # sandbox | prod
PAY_RETURN_URL=http://localhost:3000/checkout/return
PAY_CANCEL_URL=http://localhost:3000/checkout/cancel

# --- Varie ---
# (aggiungi eventuali variabili future qui)
```

## Note operative
- `NEXTAUTH_SECRET` deve essere lungo almeno 32 caratteri (usa `openssl rand -base64 32`).
- Per Supabase imposta `DATABASE_URL` con il connection string pool (porta 6543) e `DIRECT_URL` con la connessione diretta (porta 5432) per migrazioni.
- In Preview evita di impostare `NEXTAUTH_URL` per non inviare link invalidi; testa il login solo in ambienti dedicati.
- `AUTH_URL` non è letto direttamente dal codice ma alcuni deploy Auth.js lo richiedono: mantienilo coerente.
- Ricordati di aggiornare i secrets su Vercel sia per `Production` sia per ciascun `Environment` (Preview/Development) e di bloccare l'uso di URL temporanei in `NEXTAUTH_URL`.

## Sicurezza applicativa

## Threat model sintetico
| Componente | Minaccia | Mitigazioni attuali | Note |
| --- | --- | --- | --- |
| Magic link email (NextAuth) | Furto link, enumerazione email | Link valido 10 minuti, whitelist `ADMIN_EMAILS`, cleanup utente non autorizzato, sessione JWT `httpOnly` | Nessun rate limit integrato: usare provider SMTP affidabile e monitorare abuso. |
| Sessione JWT | Replay token, cookie theft | Cookie `next-auth.session-token` è `httpOnly`/`secure` in produzione. Middleware valida token con `NEXTAUTH_SECRET`. | Impostare `NEXTAUTH_URL` corretto per garantire `secure`. Considerare `sameSite='lax'` (default) adeguato. |
| Middleware admin | Bypass diretto API | `middleware.ts` protegge `/admin/:path*`; API admin richiedono sessione valida (`getToken`). | Attenzione a route nuove: assicurarsi che vivano sotto `/admin` o validino token server-side. |
| Checkout & prenotazioni | CSRF, spam | Richieste JSON + cookie `cart_token` `httpOnly`. Validazione Zod e `agreePrivacy` obbligatorio. | Non c'è rate limit → valutare Edge Middleware/Reverse proxy. Considerare captcha per `/api/bookings`. |
| SMTP credentials | Compromissione | Conservate in env `SMTP_*`. NextAuth fallisce all'avvio se mancanti. | Ruotare periodicamente e usare provider con 2FA. |
| Prisma/PostgreSQL | SQL injection, perdita dati | Prisma ORM tipizzato, `DATABASE_URL` segreto. | Configurare backup automatici e rotazione password DB. |

## Header e redirect
- Next.js gestisce automaticamente `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- Per forzare HTTPS su tutti i domini impostare redirect 301 e HSTS (vedi `docs/BUILD_AND_DEPLOY.md`).
- Considerare CSP custom in `next.config.mjs` se si introduce contenuto esterno dinamico.

## Logging e audit
- NextAuth logga errori su console Vercel (privacy: non include token).
- `src/lib/auth.ts` logga cleanup utenti non autorizzati (`console.warn`). Monitorare per spotting di tentativi di accesso.
- API booking/checkout loggano errori (`console.error`) con stack trace. Configurare forwarding verso un sistema centralizzato (Better Stack/Datadog) per audit.

## Gestione segreti
- Segreti in `.env` / Vercel: `NEXTAUTH_SECRET`, `SMTP_PASS`, `REVOLUT_SECRET_KEY`, `DATABASE_URL`, `DIRECT_URL`.
- Ruotare `NEXTAUTH_SECRET` in caso di sospetto leak (obbliga logout globale).
- Non committare `.env.local`. Usa `docs/.env.example` come riferimento.
- Per debug in locale, tenere `ADMIN_EMAILS` minimale e cambiare password/secret una volta finito.

## Hardening TODO
| Priorità | Attività | Dettagli |
| --- | --- | --- |
| Alta | Implementare rate limiting su `/api/auth/*`, `/api/bookings`, `/api/payments/checkout` | Usare edge middleware, Cloudflare Turnstile o Reverse proxy (Supabase Functions) per ridurre brute-force. |
| Alta | Configurare backup automatici Supabase + test ripristino trimestrale | Script `pg_dump` + restore in ambiente staging. Documentare esito. |
| Media | Abilitare CSP e `Permissions-Policy` | Definire whitelist per script (Next.js, Revolut, analytics) e bloccare embedding non autorizzato. |
| Media | Monitorare login falliti | Inviare alert quando `signIn` ritorna `false` per email non whitelisted o errori SMTP. |
| Media | Verificare redirect `/admin/signin?from=` | Sanitizzare param per evitare open redirect (attualmente limitato a pathname ma aggiungere validazione esplicita). |
| Bassa | Ruotare periodicamente `ADMIN_EMAILS` e cleanup utenti residui | Query Prisma per rimuovere `User` non presenti nella whitelist. |
| Bassa | Documentare processo di rotazione segreti (SMTP, Revolut, Supabase) | Checklist in `OPERATIONS.md`. |

## Check periodici
- Testa login admin una volta a settimana (magic link funzionante, email ricevuta in <1 min).
- Verifica che `NEXTAUTH_URL` in Vercel corrisponda al dominio attivo dopo cambi DNS.
- Controlla i log di Supabase per query lente o errori `connection limit`.
- Aggiorna dipendenze di sicurezza (NextAuth beta, Prisma) pianificando QA su staging.

## Troubleshooting rapido

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

## Runbook operativi

## Checklist rapida (≤2 minuti)
1. **Stato servizio**: `curl -I https://www.lasoluzione.eu/api/ping` → deve restituire `200 OK`.
2. **NextAuth**: `curl -I https://www.lasoluzione.eu/api/auth/session` → se `500` controlla log Vercel.
3. **Database**: esegui `pnpm prisma db pull` (staging) o `psql "$DIRECT_URL" -c 'select 1;'` per verificare connettività.
4. **SMTP**: invia mail test (Mailtrap) o controlla log provider per errori nelle ultime 24h.
5. **DNS**: `dig www.lasoluzione.eu +short` e `dig lasoluzione.eu +short` → devono puntare a Vercel.

## Incidenti comuni
### Login rotto / email non inviate
**Sintomi**: Errore `Configuration` su `/admin/signin`, email non ricevute, log `Missing env var ...`.

**Azioni**:
1. Verifica secrets su Vercel → `NEXTAUTH_URL`, `AUTH_URL`, `NEXTAUTH_SECRET`, `SMTP_*`, `MAIL_FROM`, `ADMIN_EMAILS`.
2. Controlla `DEVOPS.md` per i valori corretti (produzione = `https://www.lasoluzione.eu`).
3. Invia email manuale via `node -e "require('./src/lib/mailer').sendTest()"` (se disponibile) o `openssl s_client` per testare la connessione SMTP.
4. Se l'errore è `Missing NEXTAUTH_SECRET`, aggiorna secret, redeploy e invalida sessioni.
5. Per incidenti prolungati, aggiungi fallback: abilita login via preview con credenziali alternative (impostando `NEXTAUTH_URL` solo temporaneamente) e comunica agli admin.

### Loop redirect su /admin
**Sintomi**: Il browser resta su `/admin/signin?from=/admin`, anche dopo aver cliccato il link.

**Azioni**:
1. Cancella cookie `next-auth.session-token` e ripeti login.
2. Controlla `ADMIN_EMAILS` (case insensitive). Confronta con email del link (Mailtrap header `To:`).
3. Verifica che `NEXTAUTH_URL`/`AUTH_URL` corrispondano al dominio usato dal browser (nessun mismatch www/apex).
4. Consulta i log Vercel: cerca `[auth] Failed to cleanup unauthorized user` → indica mismatch whitelist.
5. Se necessario, crea utente manuale nel DB: `INSERT INTO "User" (id,email,role) VALUES (...)` e reinvia login.

### Errore 403/404 su root o API
**Sintomi**: `/` ritorna 403, API `cart` falliscono.

**Azioni**:
1. Controlla `next.config.mjs` per eventuali rewrite/test in corso.
2. `pnpm dev` in locale per vedere se il problema è replicabile (commit recente?).
3. Se `api/cart` fallisce con `P1001`, verificare `DATABASE_URL`/`DIRECT_URL` su Vercel (possibile rotazione password Supabase).
4. Se `api/auth` restituisce 403, controlla se i cookie sono bloccati (Chrome -> Application -> Cookies) e se HSTS/redirect sono corretti.

### Mismatch AUTH_URL / DNS
**Sintomi**: Link email porta a dominio errato, NextAuth error `http://localhost` in produzione.

**Azioni**:
1. Apri Vercel → Project → Settings → Domains: controlla Primary Domain.
2. Aggiorna secrets `NEXTAUTH_URL`, `AUTH_URL`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_BASE_URL`, `APP_BASE_URL`.
3. Redeploy produzione (`vercel --prod`).
4. Invalida eventuali link generati prima (nuovo login).

### Migrazione Prisma fallita (deploy)
**Sintomi**: Build Vercel fallisce con `P3019` o `database is busy`.

**Azioni**:
1. Conferma che `DIRECT_URL` punti a Supabase porta 5432.
2. Esegui migrazione manuale da locale: `pnpm prisma migrate deploy` usando `DATABASE_URL`/`DIRECT_URL` di produzione (VPN/connection string).
3. In caso di schema incompatibile, `pg_dump` del DB, crea nuovo database, applica migrazioni e ripristina dati.
4. Aggiorna `pnpm prisma generate` per rigenerare client, ricommitta eventuali modifiche in `.prisma/client`.

## Comunicazione incidente
- <30 min: notifica stakeholder via Slack/Email con titolo, impatto, azioni in corso.
- Ogni 30 min: aggiornamento stato.
- Risoluzione: redigi post-mortem sintetico (cause, fix, follow-up) e aggiorna sezione "Hardening TODO" in `docs/SECURITY.md` se necessario.

## Post-incident actions
- Aggiorna `CHANGELOG.md` con riferimento all'incidente e alla correzione applicata.
- Se l'incidente ha coinvolto dati, registra su registro interno GDPR (chi ha avuto accesso, durata downtime).
- Pianifica retro per automazione test/monitoring legata al problema emerso.

## Cronologia merge
- Contenuti originali: `docs/BUILD_AND_DEPLOY.md`, `docs/ENVIRONMENT.md`, `docs/SECURITY.md`, `docs/TROUBLESHOOTING.md`, `OPERATIONS.md` (ottobre 2025).
