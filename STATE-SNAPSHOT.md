# State Snapshot — 2025-10-10

## Struttura repository (≤3 livelli)
```
./
├─ docs/
│  ├─ archive/
│  ├─ AUDIT_*.md, STATE-SNAPSHOT.md (storico)
│  └─ …
├─ prisma/
│  ├─ schema.prisma
│  ├─ prisma/ (client build)
│  └─ seed.ts
├─ public/
├─ src/
│  ├─ app/
│  │  ├─ (site)/
│  │  ├─ admin/
│  │  ├─ api/
│  │  ├─ checkout/
│  │  ├─ eventi/
│  │  ├─ fake-payment/
│  │  ├─ prenota/
│  │  └─ privacy & cookie-policy
│  ├─ components/
│  ├─ hooks/
│  ├─ lib/
│  ├─ state/
│  ├─ styles/
│  └─ types/
└─ config (next.config.mjs, tailwind.config.ts, ecc.)
```

## Versioni chiave
- Next.js `14.2.33`
- React `18.3.1`
- Prisma Client `6.16.3`
- Tailwind CSS `4.1.14`
- NextAuth `5.0.0-beta.29`
- Nodemailer `6.10.1`

## Rotte UI
| Path | File sorgente | Descrizione | Auth |
| --- | --- | --- | --- |
| `/` | `src/app/(site)/page.tsx` | Landing con sezioni statiche, CTA prenotazione e mappa deferita | Pubblica |
| `/prenota` | `src/app/prenota/page.tsx` | Wizard legacy oppure carrello/catalogo se `NEXT_PUBLIC_CART_ENABLED=true` | Pubblica |
| `/checkout` | `src/app/checkout/page.tsx` | Form checkout cliente + gestione stati verifica/pagamento | Pubblica |
| `/checkout/email-sent` | `src/app/checkout/email-sent/page.tsx` | Conferma invio mail con possibilità di reinvio | Pubblica |
| `/checkout/confirm` | `src/app/checkout/confirm/page.tsx` | Reindirizza token checkout (JWT) verso `/api/payments/email-verify` | Pubblica |
| `/checkout/return` | `src/app/checkout/return/page.tsx` | Poll stato pagamento dopo redirect provider | Pubblica |
| `/checkout/cancel` | `src/app/checkout/cancel/page.tsx` | Pagamento annullato | Pubblica |
| `/checkout/success` | `src/app/checkout/success/page.tsx` | Success page (svuota carrello client) | Pubblica |
| `/privacy` | `src/app/privacy/page.tsx` | Informativa privacy (MDX semplice) | Pubblica |
| `/cookie-policy` | `src/app/cookie-policy/page.tsx` | Policy cookie + versione da env | Pubblica |
| `/fake-payment` | `src/app/fake-payment/page.tsx` | Simulator per API `fake-confirm`/`fake-cancel` | Pubblica |
| `/eventi/[slug]` | `src/app/eventi/[slug]/page.tsx` | Booking email-only per evento (`EventForm`) | Pubblica |
| `/admin` | `src/app/admin/page.tsx` | Dashboard prenotazioni | Admin (Auth.js) |
| `/admin/signin` | `src/app/admin/signin/page.tsx` | Login magic link | Pubblica |
| `/admin/not-authorized` | `src/app/admin/not-authorized/page.tsx` | Messaggio whitelist | Pubblica |
| `/admin/bookings` | `src/app/admin/bookings/page.tsx` | Gestione prenotazioni con filtri | Admin |
| `/admin/bookings/print` | `src/app/admin/bookings/print/page.tsx` | Layout stampa prenotazioni | Admin |
| `/admin/catalog/products` | `src/app/admin/catalog/products/page.tsx` | CRUD prodotti catalogo | Admin |
| `/admin/catalog/sections` | `src/app/admin/catalog/sections/page.tsx` | Gestione sezioni/assegnazioni | Admin |
| `/admin/contacts` | `src/app/admin/contacts/page.tsx` | Elenco contatti lead | Admin |
| `/admin/contacts/print` | `src/app/admin/contacts/print/page.tsx` | Stampa contatti | Admin |
| `/admin/events` | `src/app/admin/events/page.tsx` | Lista eventi (istanze) | Admin |
| `/admin/events/[id]` | `src/app/admin/events/[id]/page.tsx` | Dettaglio evento | Admin |
| `/admin/menu/dishes` | `src/app/admin/menu/dishes/page.tsx` | Gestione menu legacy | Admin |
| `/admin/settings` | `src/app/admin/settings/page.tsx` | Config prenotazioni legacy | Admin |
| `/admin/tiers` | `src/app/admin/tiers/page.tsx` | Gestione pacchetti legacy | Admin |

## API principali
| Metodo | Path | File | Note |
| --- | --- | --- | --- |
| GET/POST | `/api/cart` | `src/app/api/cart/route.ts` | Crea/carica carrello, imposta cookie `cart_token` |
| GET/PATCH | `/api/cart/:id` | `src/app/api/cart/[id]/route.ts` | Lettura carrello e ricalcolo totale |
| POST/DELETE | `/api/cart/:id/items` | `src/app/api/cart/[id]/items/route.ts` | Upsert/rimozione righe carrello |
| POST | `/api/orders` | `src/app/api/orders/route.ts` | Crea ordine da carrello (idempotente su `cartId`) |
| POST | `/api/orders/finalize` | `src/app/api/orders/finalize/route.ts` | Segna ordine pagato e invia email |
| POST | `/api/payments/checkout` | `src/app/api/payments/checkout/route.ts` | Flusso checkout: verifica email → conferma/pagamento |
| GET | `/api/payments/email-verify` | `src/app/api/payments/email-verify/route.ts` | Consuma token JWT checkout, conferma email-only |
| GET/POST | `/api/payments/order-status` | `src/app/api/payments/order-status/route.ts` | Poll stato ordine (locale + Revolut) |
| POST | `/api/bookings` | `src/app/api/bookings/route.ts` | Prenotazioni legacy (con mail) |
| POST | `/api/bookings/email-only` | `src/app/api/bookings/email-only/route.ts` | Prenotazione evento con sola email |
| GET | `/api/bookings/confirm` | `src/app/api/bookings/confirm/route.ts` | Conferma booking email-only via token e reindirizza a success |
| POST | `/api/bookings/resend-confirmation` | `src/app/api/bookings/resend-confirmation/route.ts` | Reinvio mail verifica booking |
| POST | `/api/bookings/fake-confirm` | `src/app/api/bookings/fake-confirm/route.ts` | Conferma simulata (fake-payment) |
| POST | `/api/bookings/fake-cancel` | `src/app/api/bookings/fake-cancel/route.ts` | Annulla simulato |
| POST | `/api/bookings/prepay` | `src/app/api/bookings/prepay/route.ts` | Legacy prepagamento |
| GET | `/api/booking-config` | `src/app/api/booking-config/route.ts` | Config wizard + menu/tier |
| GET | `/api/catalog` | `src/app/api/catalog/route.ts` | Esposizione catalogo/ sezioni attive |
| GET | `/api/events` | `src/app/api/events/route.ts` | Lista eventi pubblici |
| POST | `/api/newsletter` | `src/app/api/newsletter/route.ts` | Opt-in newsletter |
| Auth.js | `/api/auth/[...nextauth]` | `src/app/api/auth/[...nextauth]/route.ts` | Magic link con SMTP |
| Admin (varie) | `/api/admin/*` | `src/app/api/admin/**` | CRUD prodotti, sezioni, bookings, events, settings |

## Feature flag e configurazioni runtime
- `NEXT_PUBLIC_CART_ENABLED` – abilita il carrello in `/prenota` sostituendo il wizard legacy.
- `NEXT_PUBLIC_ADMIN_SHOW_LEGACY` – mostra link area legacy nella navigazione admin.
- `NEXT_PUBLIC_CONSENT_DEBUG` – forza visualizzazione banner cookie per debug.
- `NEXT_PUBLIC_POLICY_VERSION` – versiona il consenso cookie e mostra la release nella policy.
- `NEXT_PUBLIC_REVOLUT_ENV` / `NEXT_PUBLIC_REVOLUT_PUBLIC_KEY` – selezionano ambiente SDK e iniettano token pubblico per checkout embedded.
- `NEXT_PUBLIC_MAPS_EMBED_URL` – override iframe mappa, utile in ambienti senza Google Maps.

## Dipendenze ambientali
- **Database**: `DATABASE_URL` (SQLite per dev, richiesto per pagine evento dinamiche).
- **Auth.js**: `NEXTAUTH_SECRET` obbligatorio; `NEXTAUTH_URL` richiesto in deploy. `ADMIN_EMAILS` limita accesso admin.
- **SMTP**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `MAIL_TO_BOOKINGS` per invio email.
- **Revolut**: `REVOLUT_SECRET_KEY`, `REVOLUT_API_VERSION`, `REVOLUT_API_BASE` (opzionale), `PAY_RETURN_URL`, `PAY_CANCEL_URL`.
- **Sito pubblico**: `NEXT_PUBLIC_BASE_URL` / `APP_BASE_URL` / `BASE_URL` usati per link email e redirect.
- **Cookie**: `NEXT_PUBLIC_POLICY_VERSION`, `NEXT_PUBLIC_SITE_URL` (sitemap), `NEXT_PUBLIC_CONSENT_DEBUG`.

## Health check
| Verifica | Stato | Note |
| --- | --- | --- |
| `pnpm build` | ⚠️ Non eseguito | Audit documentale, non richiesto in questo passaggio |
| `pnpm lint` | ⚠️ Non eseguito | Audit documentale, non richiesto in questo passaggio |
| `pnpm dev` | ⚠️ Non eseguito | Non avviato durante la revisione |
