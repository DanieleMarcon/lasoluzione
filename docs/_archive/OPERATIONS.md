# Operations runbook

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
2. Controlla `docs/ENVIRONMENT.md` per i valori corretti (produzione = `https://www.lasoluzione.eu`).
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
