---
merged_from:
  - docs/ARCHITECTURE.md
  - docs/STATE-SNAPSHOT.md
  - STATE-SNAPSHOT.md
updated: 2025-02-14
---
# Aggiornato al: 2025-02-15

## Mini-TOC
- [Architettura & Stato Sistema](#architettura--stato-sistema)
  - [Diagramma logico applicazione](#diagramma-logico-applicazione)
  - [Boundary principali](#boundary-principali)
  - [Logging e osservabilità](#logging-e-osservabilità)
  - [Snapshot repository (2025-10-10)](#snapshot-repository-2025-10-10)
  - [Versioni chiave](#versioni-chiave)
  - [Rotte principali UI](#rotte-principali-ui)
  - [API principali (estratto)](#api-principali-estratto)
  - [Modelli attivi & migrazioni](#modelli-attivi--migrazioni)
  - [Note operative](#note-operative)
  - [Feature flag & configurazioni runtime](#feature-flag--configurazioni-runtime)
  - [Dipendenze ambientali](#dipendenze-ambientali)
- [Riferimenti incrociati](#riferimenti-incrociati)
- [Provenienza & Storia](#provenienza--storia)

# Architettura & Stato Sistema

> Questo documento sostituisce la precedente `docs/ARCHITECTURE.md`, le snapshot di stato (`docs/STATE-SNAPSHOT.md`, `STATE-SNAPSHOT.md`) e funge da overview tecnica aggiornata.

## Diagramma logico applicazione
```text
[Browser]
   │  (React client components, hook useCart, Zustand consent)
   ▼
Next.js App Router (src/app)
   │  ├─ UI pubblica (landing, prenota, checkout, eventi)
   │  └─ UI admin (dashboard, catalogo, eventi)
   ▼
Server actions & API (src/app/api/*)
   │  ├─ Cart & Orders (/api/cart, /api/orders)
   │  ├─ Checkout/Payments (/api/payments/*)
   │  ├─ Bookings legacy (/api/bookings/*)
   │  ├─ Admin endpoints (/api/admin/*)
   │  └─ Auth.js (/api/auth/[...nextauth])
   ▼
Domain layer (src/lib)
   │  ├─ Prisma client + query helpers (prisma.ts, cart.ts, orders.ts)
   │  ├─ Checkout utilities (paymentRef, revolut, revolutLoader)
   │  ├─ Mailer & templates (mailer.ts, admin/emails.ts)
   │  ├─ Booking verification (bookingVerification.ts)
   │  ├─ Utilities (jwt.ts, logger.ts, date.ts)
   ▼
Prisma ORM → PostgreSQL/Supabase (prisma/schema.prisma, seed.ts)
   │
   └─ External services: SMTP provider, Revolut Merchant API
```

## Boundary principali
- **Frontend client**: componenti con `"use client"` (checkout page, fake-payment, hook `useCart`) gestiscono stato locale, sessionStorage (`order_verify_token`) e invocano API REST.
- **Frontend server**: layout e pagine server-only (admin dashboard, eventi) eseguono query Prisma direttamente grazie a React Server Components.
- **API/Server actions**: tutta la logica mutativa passa dalle route in `src/app/api/**` (non sono usate server actions esplicite). Ogni endpoint valida input con Zod o controlli manuali e usa helper di `src/lib`. Per payload completi vedere `BACKEND.md` sezione “API Reference 2025”.
- **Domain layer**: file in `src/lib/**` incapsulano accesso DB e integrazioni (mailer, Revolut). Evitare di chiamare Prisma direttamente dalle pagine quando esiste un helper dedicato.
- **Background / side effects**: invio email sempre tramite `src/lib/mailer.ts` con fallback log-only se SMTP non configurato; integrazione Revolut centralizzata in `src/lib/revolut.ts`.

## Logging e osservabilità
- `src/lib/logger.ts` espone `logger.info|warn|error` che serializza in JSON e maschera email (`maskEmail`).
- API critiche (`/api/payments/*`, `/api/bookings/email-only`) emettono log strutturati con chiavi `action`, `orderId`, `email`.
- Errori irreversibili vengono anche riportati via `console.error`; in sviluppo Prisma logga query/warn.
- Non esiste tracing centralizzato: per future estensioni si può collegare `logger` a una sink esterna.

## Snapshot repository (2025-10-10)
```text
./
├─ docs/
│  └─ (documentazione tematica consolidata)
├─ prisma/
│  ├─ schema.prisma
│  ├─ migrations/
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
│  │  └─ informative legali
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

## Rotte principali UI
| Path | File sorgente | Descrizione | Auth |
| --- | --- | --- | --- |
| `/` | `src/app/(site)/page.tsx` | Landing con sezioni statiche, CTA prenotazione e mappa deferita | Pubblica |
| `/prenota` | `src/app/prenota/page.tsx` | Wizard legacy oppure carrello/catalogo se `NEXT_PUBLIC_CART_ENABLED=true` | Pubblica |
| `/checkout` | `src/app/checkout/page.tsx` | Form checkout cliente + gestione stati verifica/pagamento | Pubblica |
| `/checkout/email-sent` | `src/app/checkout/email-sent/page.tsx` | Conferma invio mail con possibilità di reinvio | Pubblica |
| `/checkout/confirm` | `src/app/checkout/confirm/page.tsx` | Consuma token prenotazione legacy (`/api/bookings/confirm`) | Pubblica |
| `/checkout/return` | `src/app/checkout/return/page.tsx` | Poll stato pagamento dopo redirect provider | Pubblica |
| `/checkout/cancel` | `src/app/checkout/cancel/page.tsx` | Pagamento annullato | Pubblica |
| `/checkout/success` | `src/app/checkout/success/page.tsx` | Success page (svuota carrello client) | Pubblica |
| `/privacy` | `src/app/privacy/page.tsx` | Informativa privacy (MDX semplice) | Pubblica |
| `/cookie-policy` | `src/app/cookie-policy/page.tsx` | Policy cookie + versione da env | Pubblica |
| `/fake-payment` | `src/app/fake-payment/page.tsx` | Simulator per API `fake-confirm`/`fake-cancel` | Pubblica |
| `/eventi/[slug]` | `src/app/eventi/[slug]/page.tsx` | Booking email-only per evento (`EventForm`) | Pubblica |
| `/admin/...` | Vedi `docs/FRONTEND.md` sezione area amministrazione | Admin (Auth.js) |

> CRM: per contratto `/api/admin/contacts` consulta `docs/BACKEND.md` (sezione *Admin Contacts API*); per struttura e navigazione aggiornata dell'area admin vedi `docs/FRONTEND.md` (*Navigazione laterale*).

## API principali (estratto)
| Metodo | Path | File | Note |
| --- | --- | --- | --- |
| GET/POST | `/api/cart` | `src/app/api/cart/route.ts` | Crea/carica carrello, imposta cookie `cart_token`. |
| POST | `/api/orders` | `src/app/api/orders/route.ts` | Crea ordine da carrello (idempotente su `cartId`). |
| POST | `/api/payments/checkout` | `src/app/api/payments/checkout/route.ts` | Flusso checkout: verifica email → conferma/pagamento. |
| GET | `/api/payments/email-verify` | `src/app/api/payments/email-verify/route.ts` | Consuma token verifica, conferma email-only. |
| GET/POST | `/api/payments/order-status` | `src/app/api/payments/order-status/route.ts` | Poll stato ordine (locale + Revolut). |
| POST | `/api/bookings/email-only` | `src/app/api/bookings/email-only/route.ts` | Prenotazione evento con sola email. |
| GET | `/api/catalog` | `src/app/api/catalog/route.ts` | Esposizione catalogo/sezioni attive. |
| GET | `/api/events` | `src/app/api/events/route.ts` | Lista eventi pubblici. |
| POST | `/api/newsletter` | `src/app/api/newsletter/route.ts` | Opt-in newsletter. |
| Auth.js | `/api/auth/[...nextauth]` | `src/app/api/auth/[...nextauth]/route.ts` | Magic link con SMTP. |
| GET | `/api/admin/contacts` | `src/app/api/admin/contacts/route.ts` | Endpoint admin: filtri `q`, `newsletter`, `privacy`, range date (`yes`/`no`/`all`); risposta `{ data, total, page, pageSize }`, 401 se non admin.【F:src/app/api/admin/contacts/route.ts†L1-L63】【F:src/lib/admin/contacts-service.ts†L1-L78】 |

## Modelli attivi & migrazioni
- **Booking / BookingVerification / BookingSettings**: flussi prenotazioni legacy e email-only con token conferma.
- **Product / CatalogSection / SectionProduct**: catalogo riusabile per landing e carrello.
- **EventInstance / EventTier / MenuDish**: eventi e pacchetti legacy bridgati nel nuovo dominio prodotti.
- **Cart / CartItem / Order**: fondazione carrello/checkout con collegamento a Booking.
- **Auth.js (User, Account, Session, VerificationToken)**: login magic link amministratori.

### Migrazioni principali
| ID | Sintesi |
| --- | --- |
| 20251001150916_init | Base booking/auth.
| 20251002071639_add_type_and_flags | Tipologie prenotazione + flag consenso.
| 20251002133537_booking_settings | Configurazioni booking.
| 20251002160000_admin_auth & 20251003051448_admin_auth | Upgrade Auth.js e conversione JSON.
| 20251004120000_lunch_menu | Ordering piatti pranzo.
| 20251004145500_dinner_prepay_and_visible_at | Flag cena e visibilità menu.
| 20251004193000_add_cena_booking_type | Enum booking `cena`.
| 20251004180020_add_eventtier_timestamps | Timestamp pacchetti evento.
| 20251005_cart_schema | Introduzione Catalogo/Carrello/Order.
| 20251006070421_cart_relations | Indici carrello.
| 20251008065557_add_notes_to_order & 20251008083409_add_notes_to_order | Note ordine + pulizia providerRef.
| 20251009092233_add_booking_verification | BookingVerification + flag email-only sugli eventi.

## Note operative
- Wizard prenotazioni legacy rimane percorso ufficiale ordini finché `/api/orders` non sarà attivo con pagamento live.
- Nuove API cart/ordini sono pianificate (fase 2) e non esposte pubblicamente oltre a `/api/cart`/`/api/orders` correnti.
- Toast provider centralizzato (`src/components/admin/ui/toast.tsx`) condiviso da prodotti e sezioni.

## Feature flag & configurazioni runtime
- `NEXT_PUBLIC_CART_ENABLED` – abilita il carrello in `/prenota` sostituendo il wizard legacy.
- `NEXT_PUBLIC_ADMIN_SHOW_LEGACY` – mostra link area legacy nella navigazione admin.
- `NEXT_PUBLIC_CONSENT_DEBUG` – forza visualizzazione banner cookie per debug.
- `NEXT_PUBLIC_POLICY_VERSION` – versiona il consenso cookie e mostra la release nella policy.
- `NEXT_PUBLIC_REVOLUT_ENV` / `NEXT_PUBLIC_REVOLUT_PUBLIC_KEY` – configurano ambiente SDK e token pubblico.
- `NEXT_PUBLIC_MAPS_EMBED_URL` – override iframe mappa.

## Dipendenze ambientali
- **Database**: `DATABASE_URL` + `DIRECT_URL` (PostgreSQL/Supabase).
- **Auth.js**: `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `ADMIN_EMAILS`.
- **SMTP**: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, `MAIL_TO_BOOKINGS`.

## Riferimenti incrociati
- `BACKEND.md` — API reference, schema Prisma, ERD e matrice CORS.
- `FRONTEND.md` — dettaglio componenti UI (landing e admin) collegate ai percorsi di questa sezione.
- `PROJECT_OVERVIEW.md` — riepilogo obiettivi business e relazioni con partner esterni.

## Provenienza & Storia
SORGENTE: `docs/ARCHITECTURE.md`, `docs/STATE-SNAPSHOT.md`, `STATE-SNAPSHOT.md`
COMMIT: 9d9f5c3
MOTIVO DELLO SPOSTAMENTO: allineare struttura al consolidamento 2025-02-15 con mini-TOC e riferimenti incrociati.
DIFFERENZE CHIAVE: sezioni storiche invariate, aggiunti rimandi a `BACKEND.md` e sezione riferimenti per navigazione rapida.
- **Revolut**: `REVOLUT_SECRET_KEY`, `REVOLUT_API_VERSION`, `PAY_RETURN_URL`, `PAY_CANCEL_URL`.
- **Sito pubblico**: `NEXT_PUBLIC_BASE_URL` / `APP_BASE_URL` / `BASE_URL` per link email e redirect.
- **Cookie**: `NEXT_PUBLIC_POLICY_VERSION`, `NEXT_PUBLIC_SITE_URL`.

## Health check (ultimo audit)
| Verifica | Stato | Note |
| --- | --- | --- |
| `pnpm build` | ⚠️ Non eseguito | Audit documentale, non richiesto in questo passaggio |
| `pnpm lint` | ⚠️ Non eseguito | Audit documentale, non richiesto in questo passaggio |
| `pnpm dev` | ⚠️ Non eseguito | Non avviato durante la revisione |

## Cronologia merge
- Contenuti originali: `docs/ARCHITECTURE.md`, `docs/STATE-SNAPSHOT.md`, `STATE-SNAPSHOT.md` (ottobre 2025).
