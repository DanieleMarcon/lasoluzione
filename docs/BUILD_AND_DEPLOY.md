# Build & deploy (Vercel)

## Pipeline
- **Repository principale** → branch `main` deploya in produzione su Vercel.
- Ogni branch crea un **Preview Deployment** (`https://<branch>-lasoluzione.vercel.app`).
- Runtime configurato da `package.json` → `engines.node ">=20 <21"`; Vercel sceglierà Node.js 20.
- Package manager: `pnpm@10.0.0` (`packageManager`). Assicurarsi che Vercel usi pnpm (`ENABLE_EXPERIMENTAL_COREPACK=1` è implicito).
- Build command default (`vercel`): `pnpm install` → `pnpm build`. Il postinstall esegue `prisma generate` a meno che `SKIP_PRISMA_GENERATE=1`.
- Output Next.js App Router (serverless/edge) → nessuna configurazione custom di build directory.

### Variabili d'ambiente in Vercel
- Imposta tutte le variabili elencate in `docs/ENVIRONMENT.md` nelle tre sezioni `Production`, `Preview`, `Development`.
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
