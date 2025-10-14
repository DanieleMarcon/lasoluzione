# Ambiente & variabili

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
