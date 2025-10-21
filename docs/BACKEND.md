---
merged_from:
  - docs/AUDIT_BACKEND.md
  - docs/DATABASE.md
  - docs/API_CART.md
  - docs/AUTH.md
  - docs/EMAIL.md
  - docs/EVENTS_PUBLIC_API.md
updated: 2025-02-14
---
Aggiornato al: 2025-02-15

## Mini-TOC
- [Executive summary](#executive-summary)
- [Stato attuale del backend a colpo d’occhio](#stato-attuale-del-backend-a-colpo-docchio)
- [API Reference 2025](#api-reference-2025)
  - [Rotte pubbliche](#rotte-pubbliche)
  - [Rotte amministrative](#rotte-amministrative)
  - [Rotte di utilità e debug](#rotte-di-utilità-e-debug)
  - [Esempi payload e risposte](#esempi-payload-e-risposte)
- [Middleware e sicurezza](#middleware-e-sicurezza)
- [CORS e origin consentite](#cors-e-origin-consentite)
- [Catalogo errori applicativi](#catalogo-errori-applicativi)
- [Database & Prisma](#database--prisma)
  - [Schema Prisma (snapshot)](#schema-prisma-snapshot)
  - [ERD](#erd)
  - [Migrazioni e impatti](#migrazioni-e-impatti)
  - [Vincoli e indici](#vincoli-e-indici)
  - [Policy Supabase](#policy-supabase)
- [Riferimenti incrociati](#riferimenti-incrociati)
- [Provenienza & Storia](#provenienza--storia)

# Backend, API & Data Layer

> Questo documento sostituisce i file: `docs/AUDIT_BACKEND.md`, `docs/DATABASE.md`, `docs/API_CART.md`, `docs/AUTH.md`, `docs/EMAIL.md`, `docs/EVENTS_PUBLIC_API.md`. Riunisce panoramica architetturale, API, autenticazione, database e notifiche.

## Executive summary
* Backend Next.js App Router con API server-side e Prisma su SQLite: modelli `Booking`, `Product`, `CatalogSection`, `EventInstance`, carrello e Auth.js centralizzano prenotazioni, catalogo e accessi.【F:prisma/schema.prisma†L1-L304】
* Middleware e helper `assertAdmin` vincolano tutte le rotte `/admin` alla whitelist di email gestita via env, garantendo isolamento dell’area riservata.【F:src/lib/admin/session.ts†L1-L23】【F:src/_middleware.ts.off†L1-L34】
* La configurazione prenotazioni è normalizzata da `getBookingSettings`, riusata sia dal frontend pubblico (`/api/booking-config`) sia dagli strumenti admin, riducendo incoerenze tra flussi.【F:src/lib/bookingSettings.ts†L1-L104】【F:src/app/api/booking-config/route.ts†L14-L68】
* Il dominio ordini integra Revolut e mailer centralizzati, con funzioni idempotenti (`createOrderFromCart`, `finalizePaidOrder`) per carrelli e pagamenti.【F:src/lib/orders.ts†L154-L361】【F:src/app/api/payments/checkout/route.ts†L18-L311】
* Criticità principale: l’elenco "Eventi – prenotazione via email" in admin resta vuoto perché `fetchAdminEventInstances` interroga `EventInstance` ma non esiste seed né CRUD per popolarla (solo PATCH su record esistenti).【F:src/lib/admin/event-instances.ts†L5-L26】【F:src/components/admin/settings/SettingsForm.tsx†L392-L458】【F:prisma/seed.ts†L401-L411】【F:src/app/api/admin/event-instances/[id]/route.ts†L20-L63】
* Mancano API REST per creare/listare EventInstance, perciò il flusso email-only dipende da inserimenti manuali in DB non coperti da documentazione o UI.【F:src/app/api/admin/event-instances/[id]/route.ts†L20-L63】【F:docs/_archive/EMAIL_ONLY_BOOKING_TEST.md†L21-L85】
* Logging distribuito fra `logger.info/warn/error` e `console.*` fornisce visibilità minima ma frammentata; non c’è osservabilità centralizzata o tracing.【F:src/lib/logger.ts†L1-L49】【F:src/app/api/bookings/email-only/route.ts†L102-L127】

## Stato attuale del backend a colpo d’occhio
* **Stack**: Next.js App Router con rotte server in `src/app/api`, middleware di sessione via Auth.js e Prisma Client condiviso, database SQLite configurato in `schema.prisma`.【F:src/app/api/bookings/route.ts†L1-L191】【F:src/_middleware.ts.off†L1-L34】【F:prisma/schema.prisma†L1-L208】
* **Autenticazione**: provider email magic link (`next-auth` + PrismaAdapter), secret ed SMTP obbligatori, ruoli limitati a `admin` e whitelist `ADMIN_EMAILS` per accesso admin.【F:src/lib/auth.ts†L13-L91】【F:src/lib/admin/emails.ts†L1-L28】【F:src/lib/admin/session.ts†L1-L23】
* **Prenotazioni**: logica centralizzata in `bookingSettings`, `lunchOrder`, `bookingVerification`; API pubbliche gestiscono creazione, prepay, conferma token e flusso email-only.【F:src/lib/bookingSettings.ts†L1-L104】【F:src/lib/lunchOrder.ts†L1-L200】【F:src/app/api/bookings/email-only/route.ts†L1-L182】
* **Catalogo/Carrello**: modelli `Product`, `CatalogSection`, `SectionProduct`, `Cart`, `CartItem`, `Order`; API `/api/catalog`, `/api/cart`, `/api/orders` orchestrano browsing, checkout e pagamento (Revolut).【F:prisma/schema.prisma†L47-L191】【F:src/app/api/catalog/route.ts†L9-L164】【F:src/app/api/cart/route.ts†L1-L80】
* **Area admin**: pagine server component + client component (toast) per prenotazioni, piatti legacy, tiers, catalogo, impostazioni; tutte richiedono sessione admin e usano fetch verso API interne o Prisma diretto.【F:src/app/admin/layout.tsx†L9-L53】【F:src/app/admin/bookings/page.tsx†L1-L8】【F:src/app/admin/catalog/sections/page.tsx†L1-L54】【F:src/app/admin/settings/page.tsx†L1-L12】
* **Mailer**: wrapper Nodemailer con caching, template HTML/testo manuali per notifiche booking e ordine, usa env `SMTP_*`, `MAIL_FROM`, `MAIL_TO_BOOKINGS` per routing.【F:src/lib/mailer.ts†L5-L191】
* **Payments**: modulo Revolut gestisce ordini hosted, meta encoded in `paymentRef`, polling stato tramite `pollOrderStatus` che richiama API remote e finalizza ordini.【F:src/lib/revolut.ts†L1-L160】【F:src/lib/orders.ts†L219-L361】【F:src/app/api/payments/order-status/route.ts†L7-L106】

## Mappa delle rotte API
| Metodo | Path | Ambito | Handler (file) | Modelli Prisma toccati | Uso Auth/Middleware | Note |
| --- | --- | --- | --- | --- | --- | --- |
| GET/POST | /api/auth/[...nextauth] | pubblico | `auth/[...nextauth]/route.ts`【F:src/app/api/auth/[...nextauth]/route.ts†L1-L11】 | User, Account, Session (via Auth.js) | Middleware include `/api/auth`, gestione interna NextAuth | Endpoint standard NextAuth per sign-in magic link. |
| GET | /api/booking-config | pubblico | `booking-config/route.ts`【F:src/app/api/booking-config/route.ts†L14-L68】 | BookingSettings, MenuDish, EventTier | Nessun auth; lettura pubblica | Ritorna DTO con menu, cover e tiers attivi. |
| POST | /api/bookings | pubblico | `bookings/route.ts`【F:src/app/api/bookings/route.ts†L14-L191】 | Booking, EventTier | Nessun auth; validazione Zod | Crea prenotazioni confermate, invia email, valida tier e menu. |
| POST | /api/bookings/prepay | pubblico | `bookings/prepay/route.ts`【F:src/app/api/bookings/prepay/route.ts†L13-L166】 | Booking, EventTier | Nessun auth | Flusso pending con `prepayToken` e ordine fittizio. |
| POST | /api/bookings/email-only | pubblico | `bookings/email-only/route.ts`【F:src/app/api/bookings/email-only/route.ts†L30-L129】 | EventInstance, Booking, Product, BookingVerification | Nessun auth; usa rate log | Richiede `allowEmailOnlyBooking`, crea booking pending e token email. |
| GET | /api/bookings/confirm | pubblico | `bookings/confirm/route.ts`【F:src/app/api/bookings/confirm/route.ts†L1-L15】 | — | Nessun auth | Deprecato, risponde `410` e invita a usare `/api/payments/email-verify`. |
| POST | /api/bookings/resend-confirmation | pubblico | `bookings/resend-confirmation/route.ts`【F:src/app/api/bookings/resend-confirmation/route.ts†L13-L137】 | Booking, BookingVerification | Nessun auth; rate-limit via `assertCooldownOrThrow` | Rigenera token per pending con rate limiting per email/IP. |
| POST | /api/bookings/fake-confirm | pubblico (dev) | `bookings/fake-confirm/route.ts`【F:src/app/api/bookings/fake-confirm/route.ts†L15-L95】 | Booking | Nessun auth; usa mailer | Simula conferma pagamento anticipato (sandbox). |
| POST | /api/bookings/fake-cancel | pubblico (dev) | `bookings/fake-cancel/route.ts`【F:src/app/api/bookings/fake-cancel/route.ts†L13-L44】 | Booking | Nessun auth | Simula annullo di pagamento anticipato. |
| GET/POST | /api/cart | pubblico | `cart/route.ts`【F:src/app/api/cart/route.ts†L1-L41】 | Cart, CartItem | Nessun auth | Crea/recupera carrelli associati a cookie `cart_token`. |
| GET/PATCH | /api/cart/[id] | pubblico | `cart/[id]/route.ts`【F:src/app/api/cart/[id]/route.ts†L13-L40】 | Cart, CartItem | Nessun auth | Lettura e ricalcolo totale carrello. |
| GET | /api/catalog | pubblico | `catalog/route.ts`【F:src/app/api/catalog/route.ts†L9-L100】 | CatalogSection, SectionProduct, Product | Nessun auth | Aggrega sezioni attive con prodotti disponibili. |
| POST | /api/newsletter | pubblico | `newsletter/route.ts`【F:src/app/api/newsletter/route.ts†L1-L11】 | (nessun modello) | Nessun auth | Riceve form email (TODO double opt-in). |
| POST | /api/orders | pubblico | `orders/route.ts`【F:src/app/api/orders/route.ts†L1-L31】 | Cart, Order, Booking (via `createOrderFromCart`) | Nessun auth | Valida carrello e avvia workflow ordine. |
| POST | /api/orders/finalize | pubblico | `orders/finalize/route.ts`【F:src/app/api/orders/finalize/route.ts†L8-L18】 | Order, Booking, Cart | Nessun auth | Finalizza ordine già pagato. |
| POST | /api/payments/checkout | pubblico | `payments/checkout/route.ts`【F:src/app/api/payments/checkout/route.ts†L12-L140】 | Order, Cart | Nessun auth | Crea ordine Revolut o finalizza free, invia mail pagamento. |
| GET/POST | /api/payments/order-status | pubblico | `payments/order-status/route.ts`【F:src/app/api/payments/order-status/route.ts†L7-L53】 | Order | Nessun auth | Polling stato ordine via DB + Revolut. |
| GET | /api/admin/_whoami | admin | `admin/_whoami/route.ts`【F:src/app/api/admin/_whoami/route.ts†L6-L32】 | (nessun modello) | Middleware + NextAuth token | Debug sessione dev con env summary. |
| GET | /api/admin/bookings | admin | `admin/bookings/route.ts`【F:src/app/api/admin/bookings/route.ts†L12-L42】 | Booking | `assertAdmin` | Lista paginata prenotazioni con filtri. |
| GET | /api/admin/contacts | admin | `admin/contacts/route.ts`【F:src/app/api/admin/contacts/route.ts†L1-L152】 | Booking | `assertAdmin` (401 se non admin) | Contatti deduplicati per email con paginazione (`page` ≥1, `pageSize` ≤200), filtri `q`, `newsletter`, `privacy`, `from`, `to` normalizzati a `yes`/`no`/`all`; risposta `{ data, total, page, pageSize }` con fallback automatico tra funzione `*_with_total` e contatore separato.【F:src/lib/admin/contacts-service.ts†L7-L230】 |
| PATCH/DELETE | /api/admin/bookings/[id] | admin | `admin/bookings/[id]/route.ts`【F:src/app/api/admin/bookings/[id]/route.ts†L41-L120】 | Booking, BookingSettings | `assertAdmin` | Update/soft delete booking, valida tipi e date. |
| POST | /api/admin/bookings/[id]/confirm | admin | `admin/bookings/[id]/confirm/route.ts`【F:src/app/api/admin/bookings/[id]/confirm/route.ts†L18-L62】 | Booking | `assertAdmin` | Imposta stato `confirmed` e reinvia email. |
| POST | /api/admin/bookings/[id]/cancel | admin | `admin/bookings/[id]/cancel/route.ts`【F:src/app/api/admin/bookings/[id]/cancel/route.ts†L15-L41】 | Booking | `assertAdmin` | Marca `cancelled` e invia email testo (se SMTP). |
| POST | /api/admin/bookings/[id]/resend | admin | `admin/bookings/[id]/resend/route.ts`【F:src/app/api/admin/bookings/[id]/resend/route.ts†L18-L58】 | Booking | `assertAdmin` | Reinvio conferma manuale (usa storicizzazione ordini). |
| GET/POST | /api/admin/tiers | admin | `admin/tiers/route.ts`【F:src/app/api/admin/tiers/route.ts†L43-L133】 | EventTier | `assertAdmin` | CRUD paginato pacchetti evento/aperitivo. |
| PATCH/DELETE | /api/admin/tiers/[id] | admin | `admin/tiers/[id]/route.ts`【F:src/app/api/admin/tiers/[id]/route.ts†L24-L73】 | EventTier | `assertAdmin` | Aggiorna/soft delete tier. |
| GET/POST | /api/admin/menu/dishes | admin | `admin/menu/dishes/route.ts`【F:src/app/api/admin/menu/dishes/route.ts†L43-L157】 | MenuDish | `assertAdmin` | Legacy CRUD piatti pranzo con filtri. |
| PATCH/DELETE | /api/admin/menu/dishes/[id] | admin | `admin/menu/dishes/[id]/route.ts`【F:src/app/api/admin/menu/dishes/[id]/route.ts†L34-L109】 | MenuDish | `assertAdmin` | Aggiorna slug, stato e visibilità; soft/hard delete. |
| PATCH | /api/admin/event-instances/[id] | admin | `admin/event-instances/[id]/route.ts`【F:src/app/api/admin/event-instances/[id]/route.ts†L20-L63】 | EventInstance | `assertAdmin` | Unico endpoint: toggle `allowEmailOnlyBooking`. Nessun GET/POST. |
| GET/POST | /api/admin/products | admin | `admin/products/route.ts`【F:src/app/api/admin/products/route.ts†L42-L140】 | Product | `assertAdmin` | CRUD catalogo prodotti unificato. |
| PATCH/DELETE | /api/admin/products/[id] | admin | `admin/products/[id]/route.ts`【F:src/app/api/admin/products/[id]/route.ts†L33-L135】 | Product | `assertAdmin` | Update selettivo e soft delete con controllo slug. |
| GET/POST | /api/admin/sections | admin | `admin/sections/route.ts`【F:src/app/api/admin/sections/route.ts†L10-L55】 | CatalogSection | `assertAdmin` | Lista e upsert sezioni catalogo. |
| POST/DELETE | /api/admin/sections/[sectionId]/products | admin | `admin/sections/[sectionId]/products/route.ts`【F:src/app/api/admin/sections/[sectionId]/products/route.ts†L13-L88】 | SectionProduct, CatalogSection, Product | `assertAdmin` | Assegna/rimuove prodotti alle sezioni. |
| GET/PUT/PATCH | /api/admin/settings | admin | `admin/settings/route.ts`【F:src/app/api/admin/settings/route.ts†L52-L178】 | BookingSettings | `assertAdmin` | Lettura/aggiornamento impostazioni prenotazioni. |

## Albero sorgenti rilevante (code-map)
### src/app/api
- `booking-config/route.ts` — DTO pubblico che aggrega impostazioni, piatti attivi e tier evento.【F:src/app/api/booking-config/route.ts†L14-L68】
- `bookings/route.ts` — Endpoint principale creazione prenotazioni con validazioni tier/menu.【F:src/app/api/bookings/route.ts†L14-L191】
- `bookings/prepay/route.ts` — Variante pending con token per pagamento anticipato.【F:src/app/api/bookings/prepay/route.ts†L13-L166】
- `bookings/email-only/route.ts` — Flusso eventi senza pagamento basato su `EventInstance` e token email.【F:src/app/api/bookings/email-only/route.ts†L30-L129】
- `bookings/confirm|resend|fake-*` — Conferma token legacy (ora deprecata), resend rate-limited e simulazioni sandbox.【F:src/app/api/bookings/confirm/route.ts†L1-L15】【F:src/app/api/bookings/resend-confirmation/route.ts†L39-L137】【F:src/app/api/bookings/fake-confirm/route.ts†L15-L95】
- `cart/route.ts` & `[id]/route.ts` — Gestione carrello (creazione, ricalcolo totale).【F:src/app/api/cart/route.ts†L1-L41】【F:src/app/api/cart/[id]/route.ts†L13-L40】
- `catalog/route.ts` — Costruzione vetrina sezioni e prodotti attivi.【F:src/app/api/catalog/route.ts†L9-L100】
- `newsletter/route.ts` — Stub raccolta email con TODO double opt-in.【F:src/app/api/newsletter/route.ts†L1-L11】
- `orders/route.ts` & `orders/finalize/route.ts` — Creazione e finalizzazione ordini con fallback idempotente.【F:src/app/api/orders/route.ts†L8-L31】【F:src/app/api/orders/finalize/route.ts†L8-L18】
- `payments/checkout|order-status` — Integrazione Revolut e polling stato pagamenti.【F:src/app/api/payments/checkout/route.ts†L18-L140】【F:src/app/api/payments/order-status/route.ts†L7-L51】
- `auth/[...nextauth]/route.ts` — Esporta handler GET/POST NextAuth.【F:src/app/api/auth/[...nextauth]/route.ts†L1-L11】
- `admin/_whoami/route.ts` — Endpoint diagnostico sessione admin in dev.【F:src/app/api/admin/_whoami/route.ts†L6-L32】
- `admin/bookings/*` — Liste, update, conferma/cancel/resend prenotazioni.【F:src/app/api/admin/bookings/route.ts†L12-L42】【F:src/app/api/admin/bookings/[id]/confirm/route.ts†L18-L62】
- `admin/tiers/*` — CRUD pacchetti evento/aperitivo.【F:src/app/api/admin/tiers/route.ts†L43-L133】【F:src/app/api/admin/tiers/[id]/route.ts†L24-L82】
- `admin/menu/dishes/*` — CRUD piatti legacy con slug auto.【F:src/app/api/admin/menu/dishes/route.ts†L43-L157】【F:src/app/api/admin/menu/dishes/[id]/route.ts†L34-L115】
- `admin/event-instances/[id]/route.ts` — Solo PATCH su `allowEmailOnlyBooking` per istanza evento.【F:src/app/api/admin/event-instances/[id]/route.ts†L20-L63】
- `admin/products/*` — CRUD catalogo prodotti riusabili.【F:src/app/api/admin/products/route.ts†L42-L140】【F:src/app/api/admin/products/[id]/route.ts†L33-L135】
- `admin/sections/*` — Upsert sezioni e associazioni prodotti.【F:src/app/api/admin/sections/route.ts†L10-L55】【F:src/app/api/admin/sections/[sectionId]/products/route.ts†L13-L88】
- `admin/settings/route.ts` — Gestione BookingSettings (PUT/PATCH).【F:src/app/api/admin/settings/route.ts†L52-L178】

### src/components/admin
- `AdminNav.tsx` — Navigazione laterale con sezioni legacy/catalogo e sign-out.【F:src/components/admin/AdminNav.tsx†L60-L138】
- `AdminProviders.tsx` — Wrapper client SessionProvider per area admin.【F:src/components/admin/AdminProviders.tsx†L7-L13】
- `EmailSignInForm.tsx` — Form magic link (non mostrato, ma usato da `/admin/signin`).【F:src/app/admin/signin/page.tsx†L4-L43】
- `bookings/BookingsView.tsx` — Client component con filtri, azioni confirm/cancel/resend, stampa.【F:src/components/admin/bookings/BookingsView.tsx†L8-L180】
- `bookings/PrintTrigger.tsx` — Bottone stampa collegato a pagina print.【F:src/app/admin/bookings/print/page.tsx†L6-L47】
- `menu/MenuDishesManager.tsx` — Gestione CRUD piatti legacy con toast e modale editing.【F:src/components/admin/menu/MenuDishesManager.tsx†L1-L180】
- `tiers/TiersManager.tsx` — Gestione pacchetti evento/aperitivo con creazione, draft e toggle attivo.【F:src/components/admin/tiers/TiersManager.tsx†L1-L200】
- `catalog/ProductForm.tsx` & `CatalogProductsPageClient` — Form admin prodotti con toast e validazioni slug/prezzo.【F:src/components/admin/catalog/ProductForm.tsx†L1-L120】
- `catalog/SectionsPageClient.tsx` — UI assegnazione prodotti alle sezioni, toggle attivo/enableDateTime.【F:src/components/admin/catalog/SectionsPageClient.tsx†L1-L160】
- `settings/SettingsForm.tsx` — Gestione impostazioni prenotazioni e lista eventi email-only con toggle PATCH.【F:src/components/admin/settings/SettingsForm.tsx†L20-L458】
- `ui/toast.tsx` — Provider toast riusato nei client component.【F:src/components/admin/ui/toast.tsx†L1-L120】

### src/lib (API/Admin)
- `admin/event-instances.ts` — Fetch server-side istanze evento ordinate per startAt.【F:src/lib/admin/event-instances.ts†L5-L25】
- `admin/booking-query.ts` — Costruzione filtri bookings admin (pagina, date, status).【F:src/lib/admin/booking-query.ts†L1-L48】
- `admin/booking-dto.ts` — Mappatura Booking → DTO amministrativo.【F:src/lib/admin/booking-dto.ts†L1-L120】
- `admin/settings-dto.ts` — Normalizza BookingSettings per UI admin.【F:src/lib/admin/settings-dto.ts†L5-L24】
- `admin/session.ts` — Helper `assertAdmin` su base NextAuth + whitelist.【F:src/lib/admin/session.ts†L7-L23】
- `admin/emails.ts` — Parsing e cache di `ADMIN_EMAILS`.【F:src/lib/admin/emails.ts†L6-L28】
- `admin/contacts-service.ts` — Normalizza filtri tri-state/contatori e offre parser date condivisi; l'API ufficiale è `parseDateOrNull(v): Date|null`, mentre `parseDateParam` resta alias deprecato per compatibilità con consumer legacy.【F:src/lib/admin/contacts-service.ts†L18-L45】
- `auth.ts` — Config NextAuth email provider con env obbligatorie.【F:src/lib/auth.ts†L13-L91】
- `bookingSettings.ts` — Lettura, default e conversione DTO prenotazioni.【F:src/lib/bookingSettings.ts†L1-L104】
- `bookingVerification.ts` — Emissione/consumo token conferma (usato da API email-only).【F:src/lib/bookingVerification.ts†L1-L160】
- `cart.ts` — Helper per carrelli e calcolo totale, usati da API e orders.【F:src/lib/cart.ts†L1-L90】
- `orders.ts` — Workflow ordini, integrazione mail e booking linking.【F:src/lib/orders.ts†L154-L361】
- `revolut.ts` — Client API Revolut Orders con gestione env e hosted URLs.【F:src/lib/revolut.ts†L17-L120】
- `paymentRef.ts` — Encoding/decoding metadati provider nei campi stringa.【F:src/lib/paymentRef.ts†L1-L160】
- `mailer.ts` — Factory transport SMTP e template email booking/order.【F:src/lib/mailer.ts†L5-L191】
- `logger.ts` — Logger JSON minimale con masking email.【F:src/lib/logger.ts†L1-L49】
- `rateLimit.ts` — Cooldown in-memory per resend prenotazioni.【F:src/lib/rateLimit.ts†L1-L27】
- `prisma.ts` — Singleton Prisma con log in dev.【F:src/lib/prisma.ts†L1-L11】

### prisma
- `schema.prisma` — Definisce datasource SQLite e tutti i modelli (Booking, Product, EventInstance, Cart, Auth).【F:prisma/schema.prisma†L1-L304】
- `migrations/*/migration.sql` — Serie di step: init booking, BookingSettings, Auth tables, catalog/carrello, verifiche email, ecc. (vedi tabella migrazioni).【F:prisma/migrations/20251005_cart_schema/migration.sql†L1-L130】【F:prisma/migrations/20251009092233_add_booking_verification/migration.sql†L1-L47】
- `seed.ts` — Seed catalogo, admin users, settings; nessun inserimento EventInstance.【F:prisma/seed.ts†L15-L111】【F:prisma/seed.ts†L401-L411】

## Modelli & Migrazioni (Prisma)
### Modelli chiave
- **Booking** — Gestisce prenotazioni con tipi (`BookingType`), stato (`BookingStatus`), JSON ordini pranzo/cena, collegamento opzionale a `Order` e verifiche.【F:prisma/schema.prisma†L11-L45】
- **BookingVerification** — Token email per conferma, indici su scadenza e booking; supporta email-only flow.【F:prisma/schema.prisma†L123-L137】
- **Order / Cart / CartItem** — Workflow acquisti: carrello con snapshot articoli, ordine con `paymentRef`, note e relazione 1-1 al carrello.【F:prisma/schema.prisma†L139-L191】
- **Product / CatalogSection / SectionProduct** — Catalogo riusabile per sezioni (eventi, pranzo, ecc.) con pivot e flag visibilità.【F:prisma/schema.prisma†L47-L103】
- **EventInstance** — Istanze eventi con `allowEmailOnlyBooking` boolean e indice per prodotto/data; usate solo da email-only toggle.【F:prisma/schema.prisma†L105-L121】
- **BookingSettings** — Configurazioni globali: tipi abilitati, coperti, flag prepay pranzo/cena, JSON label.【F:prisma/schema.prisma†L193-L207】
- **EventTier** — Listino prezzi evento/aperitivo con timestamp e indice su tipo+ordine.【F:prisma/schema.prisma†L240-L252】
- **MenuDish** — Legacy menu pranzo/cena con `visibleAt`.【F:prisma/schema.prisma†L226-L238】
- **User/Account/Session** — Tabelle Auth.js per login email con ruolo admin di default.【F:prisma/schema.prisma†L254-L292】
- **VerificationToken** — Token magic link Auth.js (separato da BookingVerification).【F:prisma/schema.prisma†L294-L300】

### Tabella Migrazioni
| ID cartella | Sintesi schema | Citazioni |
| --- | --- | --- |
| 20251001150916_init | Crea tabella `Booking` base con status default `pending`. | 【F:prisma/migrations/20251001150916_init/migration.sql†L1-L12】 |
| 20251002071639_add_type_and_flags | Aggiunge campi `type`, consensi marketing/privacy su Booking. | 【F:prisma/migrations/20251002071639_add_type_and_flags/migration.sql†L8-L26】 |
| 20251002133537_booking_settings | Introduce tabella `BookingSettings` e rende `phone` obbligatorio. | 【F:prisma/migrations/20251002133537_booking_settings/migration.sql†L7-L66】 |
| 20251002160000_admin_auth | Aggiunge tabelle Auth.js (`User`, `Account`, `Session`, `VerificationToken`). | 【F:prisma/migrations/20251002160000_admin_auth/migration.sql†L1-L97】 |
| 20251003051448_admin_auth | Converte campi BookingSettings JSON → JSONB. | 【F:prisma/migrations/20251003051448_admin_auth/migration.sql†L9-L26】 |
| 20251004120000_lunch_menu | Estende Booking con campi pranzo e crea `MenuDish`; aggiunge cover/prenotazione pranzo. | 【F:prisma/migrations/20251004120000_lunch_menu/migration.sql†L1-L45】 |
| 20251004145500_dinner_prepay_and_visible_at | Aggiunge `dinnerRequirePrepay` e `MenuDish.visibleAt`. | 【F:prisma/migrations/20251004145500_dinner_prepay_and_visible_at/migration.sql†L1-L9】 |
| 20251004180020_add_eventtier_timestamps | Introduce `EventTier` e campi cena/tier su Booking/Settings. | 【F:prisma/migrations/20251004180020_add_eventtier_timestamps/migration.sql†L1-L48】 |
| 20251004193000_add_cena_booking_type | Aggiornamento enum BookingType per includere `cena`. | 【F:prisma/migrations/20251004193000_add_cena_booking_type/migration.sql†L1-L1】 |
| 20251005_cart_schema | Crea schema catalogo/carrello (`Product`, `CatalogSection`, `EventInstance`, `Cart`, `Order`). | 【F:prisma/migrations/20251005_cart_schema/migration.sql†L1-L130】 |
| 20251006070421_cart_relations | Aggiunge foreign key cart item e indici prodotti. | 【F:prisma/migrations/20251006070421_cart_relations/migration.sql†L1-L33】 |
| 20251008065557_add_notes_to_order | Aggiunge `notes` ordine e FK Booking→Order, richiede phone. | 【F:prisma/migrations/20251008065557_add_notes_to_order/migration.sql†L7-L64】 |
| 20251008083409_add_notes_to_order | Rimuove `providerRef`, mantiene `notes` su Order e indice `paymentRef`. | 【F:prisma/migrations/20251008083409_add_notes_to_order/migration.sql†L7-L31】 |
| 20251009092233_add_booking_verification | Crea `BookingVerification` e aggiunge `allowEmailOnlyBooking` su EventInstance. | 【F:prisma/migrations/20251009092233_add_booking_verification/migration.sql†L1-L47】 |

## Admin UI – Pagine & Loader
| Pagina admin | Componente principale | Data source | Azioni/Note |
| --- | --- | --- | --- |
| `/admin` | `src/app/admin/page.tsx` → dashboard Prisma (conteggi, liste) | Query dirette `prisma.booking` (conteggi, upcoming, latest).【F:src/app/admin/page.tsx†L20-L87】 | Solo lettura, link rapido prenotazioni. |
| `/admin/bookings` | `BookingsView` client con toast.【F:src/app/admin/bookings/page.tsx†L1-L8】【F:src/components/admin/bookings/BookingsView.tsx†L25-L180】 | Fetch `/api/admin/bookings` con filtri, azioni su sub-API confirm/cancel/resend. | Filtri search/type/status/date, toast success/error, stampa. |
| `/admin/contacts` | `ContactsPageClient` client + ToastProvider.【F:src/app/admin/(protected)/contacts/page.tsx†L1-L9】【F:src/components/admin/contacts/ContactsPageClient.tsx†L1-L316】 | Fetch `/api/admin/contacts` (accetta `{ items }`/`{ data }`) con filtri `q`, `newsletter`, `privacy`, `from`, `to`; normalizza date/contatori e mostra badge consensi. | Deduplica per email, fallback prenotazioni/ultimo contatto lato client. |
| `/admin/bookings/print` | Pagina server stampa elenco corrente.【F:src/app/admin/bookings/print/page.tsx†L6-L96】 | `buildAdminBookingQuery` + Prisma (select campi ridotti). | Layout print-friendly, bottone PrintTrigger. |
| `/admin/menu/dishes` | `MenuDishesManager` client.【F:src/app/admin/menu/dishes/page.tsx†L8-L44】【F:src/components/admin/menu/MenuDishesManager.tsx†L1-L120】 | Fetch `/api/admin/menu/dishes` (paginato) + azioni POST/PATCH/DELETE. | Toast per creazione/update; filtri attivo/categoria/search. |
| `/admin/tiers` | `TiersManager` client.【F:src/app/admin/tiers/page.tsx†L18-L40】【F:src/components/admin/tiers/TiersManager.tsx†L54-L138】 | Fetch iniziale `/api/admin/tiers`, poi load dinamico, POST/PATCH/DELETE. | Crea/ordina/attiva tiers, toast esito. |
| `/admin/catalog/products` | `CatalogProductsPageClient` (ProductForm).【F:src/app/admin/catalog/products/page.tsx†L4-L8】【F:src/components/admin/catalog/ProductForm.tsx†L1-L112】 | Client component invoca `/api/admin/products` per CRUD. | Form completo con flag nutrizionali, slug auto, toast. |
| `/admin/catalog/sections` | `SectionsPageClient` con Toast.【F:src/app/admin/catalog/sections/page.tsx†L1-L54】【F:src/components/admin/catalog/SectionsPageClient.tsx†L1-L160】 | Prisma server (sections + product map), poi fetch `/api/admin/sections` e `/api/admin/sections/[sectionId]/products`. | Toggle attivo/dateTime, assegnazione prodotti con ordine/featured/home. |
| `/admin/settings` | `SettingsForm` client.【F:src/app/admin/settings/page.tsx†L8-L12】【F:src/components/admin/settings/SettingsForm.tsx†L20-L188】 | Server side `fetchAdminSettingsDTO` + `fetchAdminEventInstances`; azioni `PUT/PATCH /api/admin/settings` e `PATCH /api/admin/event-instances/{id}`. | Gestisce tipi attivi, prepay, coperti e toggles evento email-only con toast. |
| `/admin/signin` | Form accesso email magic link.【F:src/app/admin/signin/page.tsx†L4-L43】 | NextAuth signIn, nessun fetch addizionale. | Mostra errori AccessDenied. |
| `/admin/not-authorized` | Pagina fallback (static).【F:src/app/admin/not-authorized/page.tsx†L1-L20】 | N/A | Messaggio accesso negato. |

### Sezione focus: /admin/settings
- `src/app/admin/settings/page.tsx` carica impostazioni e lista eventi via Prisma server utilities.【F:src/app/admin/settings/page.tsx†L8-L12】
- Query istanze evento:
  ```ts
  // src/lib/admin/event-instances.ts
  export async function fetchAdminEventInstances(): Promise<AdminEventInstance[]> {
    const instances = await prisma.eventInstance.findMany({
      orderBy: { startAt: 'asc' },
      select: { id: true, title: true, slug: true, startAt: true, allowEmailOnlyBooking: true, active: true },
    });
    return instances.map((instance) => ({
      id: instance.id,
      title: instance.title,
      slug: instance.slug,
      startAt: instance.startAt.toISOString(),
      allowEmailOnlyBooking: instance.allowEmailOnlyBooking,
      active: instance.active,
    }));
  }
  ```
  【F:src/lib/admin/event-instances.ts†L5-L25】
- Nel form, l’elenco mostra "Nessuna istanza evento disponibile" quando l’array è vuoto e i toggle PATCH chiamano `/api/admin/event-instances/{id}`.【F:src/components/admin/settings/SettingsForm.tsx†L392-L458】

## Analisi: perché la lista “Eventi – prenotazione via email” è vuota
- La UI legge le istanze tramite `fetchAdminEventInstances`, che restituisce solo dati presenti in tabella `EventInstance`; l’array è passato direttamente al client senza altre trasformazioni.【F:src/lib/admin/event-instances.ts†L5-L25】【F:src/app/admin/settings/page.tsx†L8-L12】
- Il seed ufficiale popola sezioni, piatti, tiers e utenti admin ma non crea alcuna riga in `EventInstance`, lasciando il dataset vuoto su ambienti nuovi.【F:prisma/seed.ts†L15-L111】【F:prisma/seed.ts†L401-L411】
- Non esistono API o componenti admin per creare/listare EventInstance: l’unica rotta disponibile è il PATCH su `/api/admin/event-instances/{id}` per aggiornare `allowEmailOnlyBooking`, quindi l’interfaccia non può generare nuovi eventi né mostrarli se assenti.【F:src/app/api/admin/event-instances/[id]/route.ts†L20-L63】
- La documentazione interna assume la presenza di eventi e del relativo toggle in admin, ma senza CRUD o seed non viene mai popolato l’elenco.【F:docs/_archive/EMAIL_ONLY_BOOKING_TEST.md†L21-L35】【F:src/components/admin/settings/SettingsForm.tsx†L392-L458】

**Conclusione:** la lista è vuota perché il database non contiene record `EventInstance` preesistenti e il backend espone solo un PATCH su istanze già create. Senza seed manuale o altra UI/rotta di creazione, il client riceve sempre un array vuoto e mostra il messaggio di assenza.【F:src/lib/admin/event-instances.ts†L5-L25】【F:prisma/seed.ts†L401-L411】【F:src/components/admin/settings/SettingsForm.tsx†L392-L458】

**Come verificare manualmente**
1. Accedi all’area admin, apri `/admin/settings` e verifica la sezione "Eventi – prenotazione via email" che riporta "Nessuna istanza evento disponibile".【F:src/components/admin/settings/SettingsForm.tsx†L392-L399】
2. Con la sessione admin attiva, richiama `GET /api/admin/settings` (ad esempio via `curl` con cookie sessione) per confermare che la risposta contiene solo il DTO delle impostazioni senza elenco eventi.【F:src/app/api/admin/settings/route.ts†L52-L125】
3. Interroga `GET /api/booking-config` per verificare che le configurazioni includano tiers evento ma nessuna istanza specifica, evidenziando la mancanza di EventInstance nei dati esposti.【F:src/app/api/booking-config/route.ts†L14-L68】
4. Tentare un `PATCH /api/admin/event-instances/{id}` con un ID ipotetico restituisce 404 (`Evento non trovato`), confermando l’assenza di record da aggiornare.【F:src/app/api/admin/event-instances/[id]/route.ts†L46-L60】

## Dipendenze & Config
- **Mailer**: `src/lib/mailer.ts` usa Nodemailer; richiede `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`, opzionale `MAIL_TO_BOOKINGS`. Templates custom per richieste, conferme e notifiche admin.【F:src/lib/mailer.ts†L5-L191】
- **Auth.js**: Configurazione in `src/lib/auth.ts`, legge `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`; fallisce al boot se mancanti.【F:src/lib/auth.ts†L13-L91】
- **Payments (Revolut)**: `src/lib/revolut.ts` richiede `REVOLUT_SECRET_KEY`, `REVOLUT_API_VERSION`, `REVOLUT_ENV`/`NEXT_PUBLIC_REVOLUT_ENV`, opzionale `REVOLUT_API_BASE`; `payments/checkout` usa inoltre `NEXT_PUBLIC_BASE_URL`, `NEXT_PUBLIC_REVOLUT_PUBLIC_KEY`, `PAY_RETURN_URL`, `PAY_CANCEL_URL`.【F:src/lib/revolut.ts†L33-L75】【F:src/app/api/payments/checkout/route.ts†L12-L140】
- **Altre variabili backend** (letture dirette):
  - `APP_BASE_URL`, `NEXT_PUBLIC_BASE_URL`, `BASE_URL` (costruzione link conferma).【F:src/app/api/bookings/email-only/route.ts†L36-L43】【F:src/app/api/bookings/resend-confirmation/route.ts†L17-L23】
  - `MAIL_FROM`, `SMTP_HOST`, `SMTP_PORT` (diagnostica `_whoami`).【F:src/app/api/admin/_whoami/route.ts†L18-L26】
  - `ADMIN_EMAILS` (middleware, mailer admin).【F:src/middleware.ts†L41-L52】【F:src/lib/mailer.ts†L755-L767】
  - `NEXTAUTH_SECRET` (middleware e `_whoami`).【F:src/middleware.ts†L33-L38】【F:src/app/api/admin/_whoami/route.ts†L21-L22】
  - `NEXT_PUBLIC_CART_ENABLED`, `NEXT_PUBLIC_POLICY_VERSION`, `NEXT_PUBLIC_REVOLUT_PUBLIC_KEY`, `NEXT_PUBLIC_REVOLUT_ENV` (letti anche da componenti client, documentati per completezza).【F:src/app/prenota/page.tsx†L1-L12】【F:src/components/cookies/CookieBar.tsx†L7-L12】【F:src/components/cart/CheckoutButton.tsx†L26-L33】

## Osservabilità attuale
- Logger JSON centralizzato (`src/lib/logger.ts`) con masking email, usato nei flussi email-only, conferma e resend per tracciare outcome (ok, rate-limited, error).【F:src/lib/logger.ts†L1-L49】【F:src/app/api/bookings/email-only/route.ts†L102-L127】【F:src/app/api/bookings/resend-confirmation/route.ts†L52-L135】
- Ampio uso di `console.warn/error` nelle API (prenotazioni, pagamenti, cancellazioni) per segnalare errori Zod, assenza config SMTP, rate-limit, ecc.【F:src/app/api/bookings/route.ts†L21-L187】【F:src/app/api/payments/checkout/route.ts†L44-L143】【F:src/app/api/admin/bookings/[id]/cancel/route.ts†L32-L40】
- Non esistono integrazioni con sistemi di logging esterni, metrics o tracing; tutto il reporting è su stdout e in-memory rate limits.【F:src/lib/rateLimit.ts†L1-L27】

## Allineamento con la documentazione esistente
- Docs `ADMIN.md` elencano pagine legacy/nuove, coerenti con struttura effettiva (es. `/admin/catalog/products`, `/admin/catalog/sections`).【F:docs/_archive/ADMIN.md†L8-L27】【F:src/app/admin/catalog/products/page.tsx†L4-L8】
- `EMAIL_ONLY_BOOKING_TEST.md` presume esistenza di istanze evento gestibili da admin; il codice conferma toggle ma mancano seed/CRUD, quindi i test non possono passare senza dati manuali (disallineamento).【F:docs/_archive/EMAIL_ONLY_BOOKING_TEST.md†L21-L85】【F:src/components/admin/settings/SettingsForm.tsx†L392-L458】
- Documentazione cart (`AUDIT_CART.md`/`CART_SCHEMA_NOTES.md`) menziona catalogo unificato e carrello persistente, coerente con schema e API presenti.【F:docs/_archive/CART_SCHEMA_NOTES.md†L1-L6】【F:prisma/schema.prisma†L47-L191】【F:src/app/api/cart/route.ts†L1-L41】
- Nessun riferimento nei docs a limiti attuali su EventInstance o mancanza di API dedicate: gap da evidenziare nell’onboarding tecnico. |

## Appendice
### Glossario entità
- **Booking**: prenotazione cliente con eventuali ordini pranzo/cena e link a ordine pagamento.【F:prisma/schema.prisma†L11-L45】
- **EventInstance**: singola data/slot evento collegata a prodotto, con flag `allowEmailOnlyBooking` per flusso email-only.【F:prisma/schema.prisma†L105-L121】
- **BookingVerification**: token temporaneo per confermare prenotazioni pendenti via email.【F:prisma/schema.prisma†L123-L137】
- **EventTier**: pacchetto/prezzo evento o aperitivo selezionabile in prenotazione.【F:prisma/schema.prisma†L240-L252】
- **Product / CatalogSection / SectionProduct**: catalogo modulare per sezioni (eventi, pranzo, ecc.) e assegnazioni prodotti.【F:prisma/schema.prisma†L47-L103】
- **Cart / Order / CartItem**: pipeline e-commerce per acquisti/checkout collegati alle prenotazioni.【F:prisma/schema.prisma†L139-L191】

### Tabelle di riferimento
- **Rotte API**: vedere sezione "Mappa delle rotte API" per elenco completo di endpoint, modelli e auth.
- **Modelli/Migrazioni**: sezione "Modelli & Migrazioni" riassume schema corrente e step evolutivi.

### Indice dei file citati
- `src/app/api` (tutte le rotte elencate)
- `src/app/admin` (pagine dashboard, bookings, settings, catalog)
- `src/components/admin` (BookingsView, SettingsForm, MenuDishesManager, TiersManager, ProductForm, SectionsPageClient, AdminNav, AdminProviders, toast)
- `src/lib` (admin helpers, bookingSettings, cart, orders, revolut, mailer, logger, rateLimit, prisma)
- `prisma/schema.prisma`, `prisma/migrations/*`, `prisma/seed.ts`
- `docs/_archive/ADMIN.md`, `docs/_archive/EMAIL_ONLY_BOOKING_TEST.md`, `docs/_archive/CART_SCHEMA_NOTES.md`
## API Reference 2025
Le tabelle seguenti coprono **tutte** le rotte presenti sotto `src/app/api` (pubbliche, amministrative e di debug). Ogni riga include autenticazione richiesta, shape di query/body (tipi zod o JSON Schema), risposte principali con esempi anonimizzati, errori distinti, side effect noti e owner.

### Rotte pubbliche
| Metodo & Path | Auth | Query / Body | Risposte principali | Errori specifici | Side effects | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /api/booking-config` | Nessuna | — | `200` → `{"ok":true,"settings":{...},"menu":[],"tiers":[]}`; `304` se Next cache valida | `500` `configuration_missing` quando `BookingSettings` inconsistente | Lettura `BookingSettings`, `MenuDish`, `EventTier`; nessuna mutazione | `src/app/api/booking-config/route.ts` |
| `POST /api/bookings` | Nessuna | Body `bookingSchema` (Zod) con `type`, `date`, `people`, `tier*`, `lunchOrder`, consensi | `201` → `{"ok":true,"bookingId":"bkg_..."}`; `201` + `warning` se email fallita | `409` `requiresPrepay`, `tier_unavailable`, `tier_outdated`; `400` `invalid_order`; `500` mailer | Crea `Booking`, invia email customer/backoffice (`sendBookingEmails`) | `src/app/api/bookings/route.ts` |
| `POST /api/bookings/prepay` | Nessuna | Body `prepayBookingSchema` (tipo `pranzo`/`cena`), `people`, `email`, `phone` | `201` → `{"ok":true,"prepayToken":"tok_...","bookingId":"bkg_..."}` | `400` validation, `409` `tier_unavailable`; `500` misconfig date/time | Crea `Booking` `pending`, emette token email + `prepayToken` | `src/app/api/bookings/prepay/route.ts` |
| `POST /api/bookings/email-only` | Nessuna | Body `emailOnlyBookingSchema` (`eventInstanceId` o `eventSlug`, `customer`, `people`) | `201` → `{"ok":true,"bookingId":"bkg_...","verificationToken":"ver_..."}` | `404` `event_not_found`; `409` `email_only_disabled`; `429` rate limit IP | Scrive `Booking` `pending`, crea `BookingVerification`, logga IP | `src/app/api/bookings/email-only/route.ts` |
| `POST /api/bookings/resend-confirmation` | Nessuna | Body `{ bookingId: string }` | `200` → `{"ok":true,"bookingId":"bkg_..."}` | `404` `booking_not_found`; `409` `already_confirmed`; `429` `cooldown_active` | Regenera `BookingVerification`, invia email; aggiorna `resentAt` | `src/app/api/bookings/resend-confirmation/route.ts` |
| `POST /api/bookings/fake-confirm` | Nessuna (solo QA) | Body `{ token: string }` | `200` → `{"ok":true,"bookingId":"bkg_..."}` | `404` token invalido; `410` `token_expired` | Marca booking `confirmed`, bypass pagamento (sandbox) | `src/app/api/bookings/fake-confirm/route.ts` |
| `POST /api/bookings/fake-cancel` | Nessuna (QA) | Body `{ token: string }` | `200` → `{ "ok": true }` | `404` token invalido | Marca booking `cancelled`, elimina token | `src/app/api/bookings/fake-cancel/route.ts` |
| `GET /api/bookings/confirm` | Nessuna | Query `token`; header `Accept` | `410` → `{ "ok": false, "message": "Endpoint deprecato" }` | — | Nessuna (solo redirect legacy) | `src/app/api/bookings/confirm/route.ts` |
| `POST /api/bookings/confirm` | Nessuna | Body `{ token: string }` (legacy) | `410` → `{ "ok": false, "message": "Usa /api/payments/email-verify" }` | — | Nessuna | `src/app/api/bookings/confirm/route.ts` |
| `GET /api/cart` | Nessuna | Cookie `cart_token` opzionale; query `token` | `200` → `{ "ok": true, "cart": { id, items, totals } }` | `400` token invalido | Crea carrello se assente, imposta cookie httpOnly | `src/app/api/cart/route.ts` |
| `POST /api/cart` | Nessuna | Body `{ token?: string }` | `200` → carrello aggiornato, cookie refresh | `400` token invalido | Genera nuovo `Cart` se necessario | `src/app/api/cart/route.ts` |
| `GET /api/cart/[id]` | Nessuna | Path param `id` | `200` → DTO carrello con `items[]` | `404` `cart_not_found` | Nessuna mutazione | `src/app/api/cart/[id]/route.ts` |
| `PATCH /api/cart/[id]` | Nessuna | Body `updateCartSchema` (items con qty) | `200` → `{ ok: true, cart: {...} }` | `404` `cart_not_found`; `409` `product_unavailable` | Aggiorna `CartItem`, ricalcola totals | `src/app/api/cart/[id]/route.ts` |
| `POST /api/cart/[id]/items` | Nessuna | Body `{ productId, quantity }` | `201` → `{ ok: true, cart: {...} }` | `404` `product_not_found`; `409` `max_qty_exceeded` | Upsert `CartItem`, normalizza quantity | `src/app/api/cart/[id]/items/route.ts` |
| `DELETE /api/cart/[id]/items` | Nessuna | Body `{ productId }` | `200` → `{ ok: true, cart: {...} }` | `404` `item_not_found` | Rimuove `CartItem`, ricalcola totals | `src/app/api/cart/[id]/items/route.ts` |
| `GET /api/catalog` | Nessuna | Query `sectionId?`, `includeDrafts?` | `200` → `{ "sections": [{ id, products, schedule }] }` | `500` su errore Prisma | Lettura `CatalogSection`, `SectionProduct`, `Product` | `src/app/api/catalog/route.ts` |
| `GET /api/events` | Nessuna | Query `limit?`, `after?` | `200` → `{ "events": [{ slug, startAt, items[] }] }` | `500` errori DB | Query `EventInstance`, `Product` (items) | `src/app/api/events/route.ts` |
| `POST /api/newsletter` | Nessuna | Body `{ email: string }` | `200` → `{ ok: true }` | `400` `invalid_email`; `409` `already_confirmed`; `500` provider | Scrive lead in Supabase TODO (ora stub) | `src/app/api/newsletter/route.ts` |
| `POST /api/orders` | Nessuna | Body `createOrderSchema` (cartId, contact, notes) | `200` → `{ ok: true, orderId, bookingId?, status }` | `404` `cart_not_found`; `409` `cart_empty`; `412` `cart_expired` | Chiama `createOrderFromCart`, crea `Order`, optional `Booking` link | `src/app/api/orders/route.ts` |
| `POST /api/orders/finalize` | Nessuna | Body `{ orderId: string }` | `200` → `{ ok: true, order: {...} }` | `404` `order_not_found`; `409` `already_finalized` | Marca ordine paid + `Booking` confirmed | `src/app/api/orders/finalize/route.ts` |
| `POST /api/payments/checkout` | Nessuna | Body `checkoutSchema` (contact, cartId, verifyToken?, returnUrls) | `200` → `{"status":"verify_sent"|"confirmed"|"paid_redirect","hostedPaymentUrl?":string}` | `400` validazione; `409` `cart_empty`, `verify_required`, `already_paid` | Crea/aggiorna `Order`, invia mail, chiama `createHostedPayment` Revolut, memorizza `paymentRef` | `src/app/api/payments/checkout/route.ts` |
| `GET /api/payments/email-verify` | Nessuna | Query `token` (booking verification) | `302` redirect a `/checkout?verified=1`; `302` `/checkout?error=` su fallimento | `410` token scaduto (redirect) | Aggiorna `BookingVerification`, scrive cookie `order_verify_token` | `src/app/api/payments/email-verify/route.ts` |
| `GET /api/payments/order-status` | Nessuna | Query `orderId` o `providerRef` | `200` → `{ ok: true, status: 'pending'|'paid'|'failed', orderId }` | `404` `order_not_found`; `424` `provider_error` | Polla Revolut se stato `pending`, aggiorna `Order` | `src/app/api/payments/order-status/route.ts` |
| `POST /api/payments/order-status` | Nessuna | Body `{ orderId: string }` | `200` → stato aggiornato | Stessi errori di GET | Forza refresh stato → Revolut API | `src/app/api/payments/order-status/route.ts` |
| `GET /api/ping` | Nessuna | — | `200` → `{ ok: true, ts: number }` | — | Nessuna | `src/app/api/ping/route.ts` |
| `GET /api/_debug/prisma` | Nessuna (ma solo dev) | Query `table` opzionale | `200` → dump ultima riga tabella | `403` in prod | Lettura raw Prisma per QA | `src/app/api/_debug/prisma/route.ts` |

### Rotte amministrative
| Metodo & Path | Auth | Query / Body | Risposte principali | Errori specifici | Side effects | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /api/admin/_whoami` | Sessione admin (NextAuth JWT) | — | `200` → `{ email, isWhitelisted, envSummary }` | `401` senza token | Nessuna | `src/app/api/admin/_whoami/route.ts` |
| `GET /api/admin/bookings` | `assertAdmin` | Query `page`, `status`, `dateFrom/To`, `tier`, `search` | `200` → `{ data: BookingAdminDTO[], meta: {...} }` | `400` query invalida | Lettura `Booking`, include `Order`+`Cart` | `src/app/api/admin/bookings/route.ts` |
| `GET /api/admin/bookings/export` | `assertAdmin` | Query `format=csv|json`, `status`, `date*` | `200` stream CSV/JSON | `400` formato invalido | Serializza bookings, risponde `text/csv` | `src/app/api/admin/bookings/export/route.ts` |
| `PATCH /api/admin/bookings/[id]` | `assertAdmin` | Body `updateBookingSchema` (status, notes, metadata) | `200` → booking aggiornato | `404` booking mancante; `409` stato non coerente | Aggiorna `Booking`, `BookingSettings` derived fields | `src/app/api/admin/bookings/[id]/route.ts` |
| `DELETE /api/admin/bookings/[id]` | `assertAdmin` | — | `204` | `404` booking | Soft delete (`deletedAt` timestamp) | `src/app/api/admin/bookings/[id]/route.ts` |
| `POST /api/admin/bookings/[id]/confirm` | `assertAdmin` | — | `200` → booking `confirmed` + email inviata | `404` booking; `409` stato non pendente; `500` mailer | Aggiorna `Booking.status`, `confirmedAt`, invia email | `src/app/api/admin/bookings/[id]/confirm/route.ts` |
| `POST /api/admin/bookings/[id]/cancel` | `assertAdmin` | Body `{ reason?: string }` | `200` → booking `cancelled` | `404` booking; `409` `already_cancelled` | Aggiorna stato, invia email testo | `src/app/api/admin/bookings/[id]/cancel/route.ts` |
| `POST /api/admin/bookings/[id]/resend` | `assertAdmin` | — | `200` → email reinviata | `404` booking; `409` `no_email_template` | Genera email HTML/testo e invia via Nodemailer | `src/app/api/admin/bookings/[id]/resend/route.ts` |
| `GET /api/admin/contacts` | `assertAdmin` | Query `page` ≥1, `pageSize` ≤200, `q`, `newsletter`/`privacy` (`yes`\|`no`\|`all`), `from`/`to` (YYYY-MM-DD) | `200` → `{ data, total, page, pageSize }` (camelCase) | `500` errori DB | Proxy Supabase `admin_contacts_search` con subquery `count(*)` | `src/app/api/admin/contacts/route.ts` |
| `GET /api/admin/contacts/export` | `assertAdmin` | Query `q`, `newsletter`, `privacy`, `from`, `to` (+ opz. `format`) | `200` CSV/JSON | `500` errori DB | Serializza contatti con stessi filtri dell'endpoint principale | `src/app/api/admin/contacts/export/route.ts` |
| `GET /api/admin/menu/dishes` | `assertAdmin` | Query `page`, `visibleAt` | `200` → `{ data: MenuDish[], meta }` | — | Lettura `MenuDish` | `src/app/api/admin/menu/dishes/route.ts` |
| `POST /api/admin/menu/dishes` | `assertAdmin` | Body `createMenuDishSchema` | `201` → dish creato | `400` validazione; `409` slug duplicato | Crea `MenuDish` | `src/app/api/admin/menu/dishes/route.ts` |
| `PATCH /api/admin/menu/dishes/[id]` | `assertAdmin` | Body `updateMenuDishSchema` | `200` → dish aggiornato | `404` dish; `409` slug duplicato | Aggiorna record | `src/app/api/admin/menu/dishes/[id]/route.ts` |
| `DELETE /api/admin/menu/dishes/[id]` | `assertAdmin` | — | `204` | `404` dish | Soft delete (flag `deletedAt`) | `src/app/api/admin/menu/dishes/[id]/route.ts` |
| `GET /api/admin/tiers` | `assertAdmin` | Query `page`, `type`, `active` | `200` → `{ data: EventTier[], meta }` | — | Lettura `EventTier` | `src/app/api/admin/tiers/route.ts` |
| `POST /api/admin/tiers` | `assertAdmin` | Body `createTierSchema` | `201` → tier creato | `409` label duplicata | Crea `EventTier` | `src/app/api/admin/tiers/route.ts` |
| `PATCH /api/admin/tiers/[id]` | `assertAdmin` | Body `updateTierSchema` | `200` → tier aggiornato | `404` tier | Aggiorna `EventTier` | `src/app/api/admin/tiers/[id]/route.ts` |
| `DELETE /api/admin/tiers/[id]` | `assertAdmin` | — | `204` | `404` tier | Soft delete | `src/app/api/admin/tiers/[id]/route.ts` |
| `GET /api/admin/products` | `assertAdmin` | Query `page`, `active`, `type` | `200` → `{ data: Product[], meta }` | — | Lettura `Product`, `SectionProduct` | `src/app/api/admin/products/route.ts` |
| `POST /api/admin/products` | `assertAdmin` | Body `createProductSchema` | `201` → product | `409` slug duplicato | Crea `Product`, eventuali `SectionProduct` | `src/app/api/admin/products/route.ts` |
| `PATCH /api/admin/products/[id]` | `assertAdmin` | Body `updateProductSchema` | `200` → product aggiornato | `404` product | Aggiorna `Product`, `SectionProduct` pivot | `src/app/api/admin/products/[id]/route.ts` |
| `DELETE /api/admin/products/[id]` | `assertAdmin` | — | `204` | `404` product | Soft delete + cleanup section pivot | `src/app/api/admin/products/[id]/route.ts` |
| `GET /api/admin/sections` | `assertAdmin` | — | `200` → `{ data: CatalogSection[] }` | — | Lettura `CatalogSection` con pivot | `src/app/api/admin/sections/route.ts` |
| `POST /api/admin/sections` | `assertAdmin` | Body `upsertSectionSchema` | `201`/`200` → sezione aggiornata | `409` slug duplicato | Upsert `CatalogSection` | `src/app/api/admin/sections/route.ts` |
| `GET /api/admin/sections/[sectionId]/events` | `assertAdmin` | Path `sectionId`, query `cursor` | `200` → eventi collegati | `404` sezione | Lettura pivot sezione-eventi (Supabase TODO) | `src/app/api/admin/sections/[sectionId]/events/route.ts` |
| `POST /api/admin/sections/[sectionId]/events` | `assertAdmin` | Body `{ eventId }` | `201` → relazione creata | `404` sezione/evento | Crea legame (pivot) | `src/app/api/admin/sections/[sectionId]/events/route.ts` |
| `DELETE /api/admin/sections/[sectionId]/events` | `assertAdmin` | Body `{ eventId }` | `204` | `404` relazione mancante | Rimuove legame | `src/app/api/admin/sections/[sectionId]/events/route.ts` |
| `DELETE /api/admin/sections/[sectionId]/events/[eventId]` | `assertAdmin` | Path `sectionId`, `eventId` | `204` | `404` relazione | Cancella legame singolo | `src/app/api/admin/sections/[sectionId]/events/[eventId]/route.ts` |
| `POST /api/admin/sections/[sectionId]/products` | `assertAdmin` | Body `{ productId, position }` | `201` | `404` sezione/prodotto | Crea `SectionProduct` | `src/app/api/admin/sections/[sectionId]/products/route.ts` |
| `DELETE /api/admin/sections/[sectionId]/products` | `assertAdmin` | Body `{ productId }` | `204` | `404` relazione | Cancella `SectionProduct` | `src/app/api/admin/sections/[sectionId]/products/route.ts` |
| `PATCH /api/admin/event-instances/[id]` | `assertAdmin` | Body `{ allowEmailOnlyBooking: boolean }` | `200` → evento aggiornato | `404` eventInstance | Aggiorna flag email-only | `src/app/api/admin/event-instances/[id]/route.ts` |
| `GET /api/admin/events` | `assertAdmin` | Query `page`, `q`, `after` | `200` → `{ data: EventInstance[], meta }` | — | Lettura `EventInstance`, `Product` items | `src/app/api/admin/events/route.ts` |
| `POST /api/admin/events` | `assertAdmin` | Body `createEventSchema` | `201` → evento creato | `409` slug duplicato | Crea `EventInstance`, `EventItem` | `src/app/api/admin/events/route.ts` |
| `PATCH /api/admin/events/[id]` | `assertAdmin` | Body `updateEventSchema` | `200` → evento aggiornato | `404` evento | Aggiorna `EventInstance`, items | `src/app/api/admin/events/[id]/route.ts` |
| `DELETE /api/admin/events/[id]` | `assertAdmin` | — | `204` | `404` evento | Soft delete (flag `deletedAt`) | `src/app/api/admin/events/[id]/route.ts` |
| `GET /api/admin/events/[id]/tiers` | `assertAdmin` | Path `id` | `200` → tiers legati | `404` evento | Lettura `EventTier` associati | `src/app/api/admin/events/[id]/tiers/route.ts` |
| `POST /api/admin/events/[id]/tiers` | `assertAdmin` | Body `{ tierId }` | `201` → collegamento creato | `404` evento/tier | Crea pivot `EventInstanceTier` | `src/app/api/admin/events/[id]/tiers/route.ts` |
| `PATCH /api/admin/events/tiers/[tierId]` | `assertAdmin` | Body `updateEventTierLinkSchema` | `200` → relazione aggiornata | `404` tier | Aggiorna pivot (posizione, attivo) | `src/app/api/admin/events/tiers/[tierId]/route.ts` |
| `DELETE /api/admin/events/tiers/[tierId]` | `assertAdmin` | — | `204` | `404` tier | Rimuove pivot | `src/app/api/admin/events/tiers/[tierId]/route.ts` |
| `GET /api/admin/events/search` | `assertAdmin` | Query `q` | `200` → `{ data: EventInstance[] }` | — | Ricerca full-text via Prisma `contains` | `src/app/api/admin/events/search/route.ts` |
| `GET /api/admin/settings` | `assertAdmin` | — | `200` → settings DTO | — | Lettura `BookingSettings` | `src/app/api/admin/settings/route.ts` |
| `PUT /api/admin/settings` | `assertAdmin` | Body `updateSettingsSchema` (full replace) | `200` → settings aggiornati | `400` validazione | Aggiorna `BookingSettings` (replace) | `src/app/api/admin/settings/route.ts` |
| `PATCH /api/admin/settings` | `assertAdmin` | Body partial (toggle flags, cover) | `200` → settings aggiornati | `400` validazione | Aggiornamento parziale | `src/app/api/admin/settings/route.ts` |

#### Admin Contacts API

- **Endpoint**: `GET /api/admin/contacts` (runtime Node.js, risposta JSON camelCase).
- **Autenticazione**: `assertAdmin` riusa la sessione NextAuth per verificare la whitelist.
- **Parametri query**:
  - `q`: testo libero, inoltrato come `search` alla funzione Supabase per match su nome/email/telefono.
  - `newsletter`: input libero (`true`/`false`/`1`/`0`/`yes`/`no`/etc.) normalizzato a `yes`\|`no`\|`all` (default `all`).
  - `privacy`: stesso normalizzatore di `newsletter` (`yes`\|`no`\|`all`).
  - `from` / `to`: date validabili (`YYYY-MM-DD` o ISO); stringhe vuote o invalide diventano `null`.
  - `page`: intero ≥ 1, default `1`; in anteprima/dev richieste con `page < 1` rispondono `400`, in produzione vengono clampate a `1`.
  - `pageSize`: intero tra `1` e `200`, default `20`; valori fuori range generano `400` in anteprima/dev e vengono clamped a `1..200` in produzione.
- **Risposta**: `{ data: ContactDTO[], total: number, page: number, pageSize: number }` dove `ContactDTO` espone `name`, `email`, `phone`, `lastContactAt`, `createdAt`, `privacy`, `newsletter`, `bookingsCount`, `totalBookings` (tutti camelCase). `lastContactAt`/`createdAt` sono stringhe ISO o `null`; i contatori hanno fallback `0` quando assenti.【F:src/app/api/admin/contacts/route.ts†L70-L134】【F:src/lib/admin/contacts-service.ts†L79-L98】
- **Pipeline**: l'handler tenta `public.admin_contacts_search_with_total(search, newsletter, privacy, from, to, limit, offset)` per ottenere righe e `total_count` in un'unica chiamata; gli argomenti sono sempre castati lato SQL (`::text`/`::date`/`::int`) per evitare errori di firma (`42883`). In assenza della funzione "with_total" si ricade su `public.admin_contacts_search(...)` più subquery `count(*)` con gli stessi parametri, senza mai passare `NULL` a `limit`/`offset`.【F:src/lib/admin/contacts-service.ts†L154-L231】
- **Mappatura snake_case → camelCase**: la funzione Supabase espone colonne snake_case (`last_contact_at`, `total_bookings`); l'handler converte date in stringa, conserva booleani/null e normalizza i contatori in numeri JS.【F:src/lib/admin/contacts-service.ts†L79-L98】
- **Logging**: in preview/dev (`NODE_ENV !== 'production'`) log strutturati con `requestId`, `stage` (`parse`, `sql:*`, `map`, `done`), `queryNormalized`, `sqlArgs`, `durations` e `fingerprint` degli errori; in produzione i log sono soppressi.【F:src/app/api/admin/contacts/route.ts†L17-L151】【F:src/lib/admin/contacts-service.ts†L19-L230】

**Database references**

- `public.admin_contacts_view` — espone `name`, `email`, `phone`, `last_contact_at`, `privacy`, `newsletter`, `total_bookings` in snake_case (gestito su Supabase, non modificare qui).
- `public.admin_contacts_search_with_total(search text, newsletter text, privacy text, from date, to date, limit int, offset int)` — funzione preferita: restituisce righe + `total_count`; se non disponibile, l'API ricade su `public.admin_contacts_search(...)` con subquery `count(*)` separata (stessi parametri, niente `NULL` su `limit`/`offset`).【F:src/lib/admin/contacts-service.ts†L154-L231】

- **Esempi**:
  - `GET /api/admin/contacts?page=1&pageSize=20`
  - `GET /api/admin/contacts?newsletter=yes&privacy=no&from=2025-10-01&to=2025-10-31`

### Rotte di utilità e debug
| Metodo & Path | Auth | Query / Body | Risposte principali | Errori specifici | Side effects | Owner |
| --- | --- | --- | --- | --- | --- | --- |
| `GET /api/auth/[...nextauth]` | Gestita da NextAuth | Form-data email, callback query | `200` HTML/redirect; `302` redirect sign-in/out | `401` `AccessDenied` (NextAuth) | Gestione sessioni, cookie `next-auth.session-token` | `src/app/api/auth/[...nextauth]/route.ts` |

### Esempi payload e risposte
```json
// POST /api/payments/checkout → 200 verify_sent
{
  "status": "verify_sent",
  "orderId": "ord_01J7WQF9RZ",
  "verifyToken": "ordver_2N2X",
  "hostedPaymentUrl": "https://sandbox-merchant.revolut.com/pay/checkout-123"
}
```
```json
// POST /api/orders → 200
{
  "ok": true,
  "orderId": "ord_01J7WQF9RZ",
  "bookingId": "bkg_019PCF8TQS",
  "status": "pending"
}
```
```json
// GET /api/admin/bookings → 200
{
  "data": [
    {
      "id": "bkg_019PCF8TQS",
      "date": "2025-02-20T19:30:00.000Z",
      "type": "evento",
      "people": 2,
      "status": "pending",
      "tierLabel": "Degustazione" 
    }
  ],
  "meta": { "page": 1, "total": 42, "pageSize": 20 }
}
```
```json
// POST /api/admin/bookings/[id]/confirm → 409 esempio
{
  "ok": false,
  "error": "already_confirmed",
  "message": "La prenotazione risulta già confermata"
}
```

## Middleware e sicurezza
1. **NextAuth email provider** (`src/app/api/auth/[...nextauth]/route.ts`) – valida credenziali magic link e gestisce cookie sessione.
2. **Middleware Next.js (da attivare copiando `src/_middleware.ts.off` → `middleware.ts`)** – intercetta richieste `/admin`, invoca `getToken` e redirige a `/admin/signin?from=...` se assente.【F:src/_middleware.ts.off†L1-L34】
3. **`assertAdmin`** (`src/lib/admin/session.ts`) – in ogni handler admin verifica sessione via `auth()` e controlla whitelist `ADMIN_EMAILS` in env; se mancante lancia `UnauthorizedError` con `401` o `403`.
4. **Rate limiting** – `assertCooldownOrThrow` in `src/lib/rateLimit.ts` limita resend conferma per IP/email, lanciando `cooldown_active` su ripetizione ravvicinata.
5. **Protezione CSRF** – non presente: tutte le API sono JSON-only; per operazioni sensibili si raccomanda utilizzo di sessioni server e cookie `SameSite=Lax`.
6. **Logging sicuro** – `src/lib/logger.ts` maschera email e personal data con regex base prima di inviare a `console`.

## CORS e origin consentite
| Origin | Metodi | Credenziali | Note |
| --- | --- | --- | --- |
| `https://lasoluzione.it` (prod) | GET, POST, PATCH, DELETE | Cookie di sessione e carrello (`httpOnly`, `SameSite=Lax`) | Deploy principale su Vercel (dominio custom). |
| `https://*.vercel.app` (preview) | GET, POST, PATCH, DELETE | Cookie condivisi; attenzione a mismatch dominio (admin) | Le anteprime usano stesso dominio base per API, no wildcard CORS necessario. |
| `http://localhost:3000` | GET, POST, PATCH, DELETE | Cookie disponibili in sviluppo | Next dev server. |
> Non è definita configurazione CORS custom: Next.js serve API sullo stesso dominio della UI. L'accesso cross-origin è limitato dal browser; eventuali integrazioni esterne richiedono reverse proxy o rotte dedicate.

## Catalogo errori applicativi
| Codice interno | HTTP | Messaggio (italiano) | Causa nota | Azione consigliata |
| --- | --- | --- | --- | --- |
| `requiresPrepay` | 409 | "Questa tipologia richiede pagamento anticipato." | Booking type abilitato solo via prepay (`typeRequiresPrepay`) | Offrire redirect a checkout e aggiornare UI per mostrare step pagamento. |
| `tier_unavailable` | 409 | "Tier non disponibile" | `EventTier` inattivo o mismatch label/price | Sincronizzare UI con `/api/booking-config`; ricaricare dati. |
| `tier_outdated` | 409 | "Tier aggiornato" | Prezzo/label cambiati in admin dopo fetch UI | Ricaricare form e chiedere conferma nuovo prezzo. |
| `dish_unavailable` | 409 | "Piatto non disponibile" | `MenuDish` non attivo o quantità eccessiva | Aggiornare menu, mostrare fallback. |
| `cooldown_active` | 429 | "Attendi prima di richiedere un nuovo invio" | Rate limit su resend email | Attendere 5 minuti, loggare IP/email. |
| `verify_required` | 409 | "Completa la verifica email" | Checkout chiamato senza `order_verify_token` valido | Forzare flusso email verify, mostrare CTA reinvio. |
| `already_paid` | 409 | "Ordine già pagato" | `Order.status` `paid`/`confirmed` | Evitare doppio pagamento, offrire pagina successo. |
| `provider_error` | 424 | "Errore provider pagamento" | Revolut API ha risposto errore 5xx/timeout | Ritentare dopo 30s, loggare `responseId`. |
| `table_missing` | 500 | "Contatti non disponibili" | Rotta `/api/admin/contacts` interroga tabella non migrata | Vedi Known Issue P0, creare migrazione o disabilitare feature. |
| `email_only_disabled` | 409 | "Prenotazione email-only disabilitata" | `EventInstance.allowEmailOnlyBooking` false | Abilitare via admin settings o mostrare messaggio alt. |
| `cart_empty` | 409 | "Il carrello è vuoto" | Nessun `CartItem` attivo durante checkout | Forzare reload carrello; se bug, indagare seed. |

## Database & Prisma
### Schema Prisma (snapshot)
```prisma
// prisma/schema.prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "debian-openssl-1.1.x", "debian-openssl-3.0.x"]
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL") // pooled 6543 -> runtime/app
  directUrl = env("DIRECT_URL") // direct 5432 -> migrazioni/CLI
}

/**
 * -------------------- BOOKING & LEGACY --------------------
 */

model Booking {
  id     Int      @id @default(autoincrement())
  date   DateTime
  people Int
  name   String
  email  String
  phone  String
  notes  String?

  // Estensioni
  type           BookingType
  agreePrivacy   Boolean       @default(false)
  agreeMarketing Boolean       @default(false)
  status         BookingStatus @default(pending)
  prepayToken    String?

  lunchItemsJson      Json?
  coverCents          Int?
  subtotalCents       Int?
  totalCents          Int?
  dinnerItemsJson     Json?
  dinnerSubtotalCents Int?
  dinnerCoverCents    Int?
  dinnerTotalCents    Int?
  tierType            String?
  tierLabel           String?
  tierPriceCents      Int?

  orderId String?
  order   Order?  @relation(fields: [orderId], references: [id])

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  verifications BookingVerification[]
}

model BookingVerification {
  id        Int       @id @default(autoincrement())
  bookingId Int
  email     String
  token     String    @unique
  nonce     String
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime  @default(now())

  Booking Booking @relation(fields: [bookingId], references: [id], onDelete: Cascade)

  @@index([bookingId])
  @@index([expiresAt])
}

model BookingSettings {
  id                  Int       @id @default(1)
  enableDateTimeStep  Boolean   @default(true)
  fixedDate           DateTime?
  fixedTime           String?
  enabledTypes        Json
  typeLabels          Json
  prepayTypes         Json
  prepayAmountCents   Int?
  coverCents          Int       @default(0)
  lunchRequirePrepay  Boolean   @default(false)
  dinnerCoverCents    Int       @default(0)
  dinnerRequirePrepay Boolean   @default(false)
  siteBrandLogoUrl    String?
  siteHeroImageUrl    String?
  siteFooterRibbonUrl String?
  site                Json? // { brandLogoUrl?: string; heroImageUrl?: string; footerRibbonUrl?: string }
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}

enum BookingType {
  pranzo
  cena
  aperitivo
  evento
}

enum BookingStatus {
  pending
  pending_payment
  confirmed
  failed
  expired
  cancelled
}

/**
 * -------------------- CATALOGO / CARRELLO --------------------
 */

model Product {
  id            Int     @id @default(autoincrement())
  slug          String  @unique
  name          String
  description   String?
  ingredients   String?
  allergens     String?
  priceCents    Int     @default(0)
  unitCostCents Int     @default(0)
  supplierName  String?
  stockQty      Int     @default(0)
  imageUrl      String?
  category      String?
  order         Int     @default(0)
  active        Boolean @default(true)
  sourceType    String?
  sourceId      String?

  // Flag nutrizionali
  isVegan       Boolean @default(false)
  isVegetarian  Boolean @default(false)
  isGlutenFree  Boolean @default(false)
  isLactoseFree Boolean @default(false)
  isOrganic     Boolean @default(false)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  // RELAZIONI
  cartItems      CartItem[]
  sections       SectionProduct[]
  eventInstances EventInstance[]

  @@index([active, order])
  @@index([category, order])
}

model CatalogSection {
  id             Int      @id @default(autoincrement())
  key            String   @unique // 'eventi' | 'aperitivo' | 'pranzo' | 'cena' | 'colazione'
  title          String
  description    String?
  enableDateTime Boolean  @default(false)
  active         Boolean  @default(true)
  displayOrder   Int      @default(0)
  createdAt      DateTime @default(now())
  updatedAt      DateTime @updatedAt

  // RELAZIONI
  products SectionProduct[]
  events   SectionEventItem[]
}

model SectionProduct {
  sectionId  Int
  productId  Int
  order      Int     @default(0)
  featured   Boolean @default(false)
  showInHome Boolean @default(false)

  // RELAZIONI
  section CatalogSection @relation(fields: [sectionId], references: [id], onDelete: Cascade)
  product Product        @relation(fields: [productId], references: [id])

  @@id([sectionId, productId])
  @@index([sectionId, order])
}

model EventInstance {
  id                    Int       @id @default(autoincrement())
  productId             Int
  slug                  String    @unique
  title                 String
  description           String?
  startAt               DateTime
  endAt                 DateTime?
  showOnHome            Boolean   @default(false)
  active                Boolean   @default(true)
  capacity              Int?
  allowEmailOnlyBooking Boolean   @default(false)
  createdAt             DateTime  @default(now())
  updatedAt             DateTime  @updatedAt

  // RELAZIONI
  product Product @relation(fields: [productId], references: [id])

  @@index([productId, startAt])
}

model EventItem {
  id          String    @id @default(cuid())
  slug        String    @unique
  title       String
  description String?
  startAt     DateTime
  endAt       DateTime?
  active      Boolean   @default(true)
  showOnHome  Boolean   @default(false)
  capacity    Int?
  priceCents  Int       @default(0)
  emailOnly   Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt

  sections SectionEventItem[]
}

model SectionEvent {
  sectionId  String
  eventId    String
  order      Int     @default(0)
  featured   Boolean @default(false)
  showInHome Boolean @default(false)

  @@id([sectionId, eventId])
  @@index([eventId])
}

model SectionEventItem {
  sectionId    Int
  eventItemId  String
  displayOrder Int     @default(999)
  featured     Boolean @default(false)
  showInHome   Boolean @default(false)

  section   CatalogSection @relation(fields: [sectionId], references: [id], onDelete: Cascade, onUpdate: Cascade)
  eventItem EventItem      @relation(fields: [eventItemId], references: [id], onDelete: Cascade, onUpdate: Cascade)

  @@id([sectionId, eventItemId])
  @@index([sectionId, displayOrder])
  @@map("SectionEventItem")
}

/**
 * -------------------- CARRELLO / ORDINI --------------------
 */

model Cart {
  id         String   @id @default(cuid())
  status     String   @default("open")
  totalCents Int      @default(0)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  // RELAZIONI
  items CartItem[]
  order Order?
}

model CartItem {
  id        Int    @id @default(autoincrement())
  cartId    String
  productId Int

  // snapshot per stabilità storica
  nameSnapshot       String
  priceCentsSnapshot Int
  qty                Int
  imageUrlSnapshot   String?
  meta               Json?
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt

  // RELAZIONI
  cart    Cart    @relation(fields: [cartId], references: [id], onDelete: Cascade)
  product Product @relation(fields: [productId], references: [id])

  @@index([cartId])
  @@index([productId])
}

model Order {
  id            String   @id @default(cuid())
  cartId        String   @unique
  email         String
  name          String
  phone         String?
  status        String   @default("pending")
  totalCents    Int
  discountCents Int?
  paymentRef    String?
  notes         String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  cart     Cart      @relation(fields: [cartId], references: [id], onDelete: Cascade)
  bookings Booking[]

  @@index([cartId, status])
  @@index([paymentRef])
}

/**
 * -------------------- LEGACY MENU / EVENT TIERS --------------------
 */

model MenuDish {
  id          Int      @id @default(autoincrement())
  name        String
  slug        String   @unique
  description String?
  priceCents  Int      @default(0)
  active      Boolean  @default(true)
  category    String?
  order       Int      @default(0)
  visibleAt   String   @default("both") // lunch | dinner | both
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model EventTier {
  id         String  @id @default(cuid())
  type       String
  label      String
  priceCents Int
  active     Boolean @default(true)
  order      Int     @default(0)

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([type, active, order])
}

/**
 * -------------------- AUTH.JS --------------------
 */

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  role          UserRole  @default(admin)

  accounts Account[]
  sessions Session[]
}

enum UserRole {
  admin
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

```

### ERD
```mermaid
erDiagram
  Booking ||--o{ BookingVerification : has
  Booking ||--o{ Order : may_link
  Order ||--|| Cart : snapshot
  Cart ||--o{ CartItem : contains
  Product ||--o{ SectionProduct : assigned
  CatalogSection ||--o{ SectionProduct : aggregates
  EventInstance ||--o{ Booking : hosts
  EventInstance ||--o{ EventItem : schedules
  EventInstance ||--o{ EventInstanceTier : pricing
  EventTier ||--o{ EventInstanceTier : linked
  MenuDish ||..|| Booking : lunchSnapshot
  User ||--o{ Session : authenticates
  User ||--o{ Account : providers
  BookingSettings ||..|| Booking : configApplied
```

### Migrazioni e impatti
| ID cartella | Data (UTC) | Sintesi schema | Impatto applicativo |
| --- | --- | --- | --- |
| `20251001150916_init` | 2025-10-01 | Crea tabella `Booking` base con status default `pending`. | Abilita raccolta prenotazioni semplici. |
| `20251002071639_add_type_and_flags` | 2025-10-02 | Aggiunge `type`, consensi marketing/privacy su Booking. | Gestione tipologie e GDPR. |
| `20251002133537_booking_settings` | 2025-10-02 | Introduce `BookingSettings` e rende `phone` obbligatorio. | Config dinamica UI, enforcement contatti. |
| `20251002160000_admin_auth` | 2025-10-02 | Aggiunge tabelle Auth.js (`User`, `Account`, `Session`, `VerificationToken`). | Sblocca area admin e magic link. |
| `20251003051448_admin_auth` | 2025-10-03 | Converte campi BookingSettings JSON → JSONB. | Supporto config nested. |
| `20251004120000_lunch_menu` | 2025-10-04 | Estende Booking con campi pranzo e crea `MenuDish`. | Gestione menù pranzo strutturata. |
| `20251004145500_dinner_prepay_and_visible_at` | 2025-10-04 | Aggiunge `dinnerRequirePrepay` e `MenuDish.visibleAt`. | Feature cena + scheduling piatti. |
| `20251004180020_add_eventtier_timestamps` | 2025-10-04 | Introduce `EventTier` e campi cena/tier su Booking/Settings. | Prezzi evento, vendita pacchetti. |
| `20251004193000_add_cena_booking_type` | 2025-10-04 | Aggiorna enum BookingType includendo `cena`. | Supporto nuova tipologia UI. |
| `20251005_cart_schema` | 2025-10-05 | Crea `Product`, `CatalogSection`, `EventInstance`, `Cart`, `CartItem`, `Order`. | Abilita catalogo/checkout con pagamento. |
| `20251006070421_cart_relations` | 2025-10-06 | Aggiunge FK cart item e indici prodotti. | Migliora integrità carrelli. |
| `20251008065557_add_notes_to_order` | 2025-10-08 | Aggiunge `Order.notes`, FK Booking→Order, phone obbligatorio. | Sincronizza note tra ordine e prenotazione. |
| `20251008083409_add_notes_to_order` | 2025-10-08 | Rimuove `providerRef`, aggiunge indice `paymentRef`. | Migliora idempotenza pagamenti. |
| `20251009092233_add_booking_verification` | 2025-10-09 | Crea `BookingVerification`, aggiunge `allowEmailOnlyBooking`. | Attiva flusso email-only con toggle evento. |

### Vincoli e indici
- **Booking**: indice `date` + `status`; FK `orderId` (ON DELETE SET NULL). Unique `prepayToken` e `verificationToken` (NULLABLE).【F:prisma/schema.prisma†L11-L121】
- **BookingVerification**: unique `(bookingId, token)`; indice `expiresAt` per cleanup automatico.【F:prisma/schema.prisma†L123-L137】
- **Cart/CartItem**: `cartId` FK ON DELETE CASCADE; indice su `(productId, cartId)` per idempotenza add/remove.【F:prisma/schema.prisma†L139-L191】
- **Product**: unique `slug`; `SectionProduct` possiede indice `(sectionId, position)` e unique `(sectionId, productId)`。【F:prisma/schema.prisma†L47-L103】
- **EventInstance**: unique `slug`; indice `(startAt)` e `(allowEmailOnlyBooking)` per filtri admin.【F:prisma/schema.prisma†L105-L121】
- **EventTier/EventInstanceTier**: unique `label`; pivot con unique `(eventInstanceId, tierId)` e `position` numerico.【F:prisma/schema.prisma†L240-L282】
- **Auth tables**: `User.email` unique; `VerificationToken.token` unique per Auth.js.【F:prisma/schema.prisma†L254-L304】

### Policy Supabase
Attualmente non sono configurate policy RLS, trigger o funzioni Supabase all’interno del repository. Le sezioni newsletter/lead rimandano a implementazioni future (`TODO` nel codice). Annotare sul ROADMAP quando le policy verranno aggiunte.

## Riferimenti incrociati
- `PAYMENTS.md` dettaglia sequenza Revolut, firma webhook e idempotenza ordine.
- `FRONTEND.md` collega ogni rotta admin alla UI (componenti React) con note di UX.
- `WORKFLOW_AND_ENVIRONMENT_GUIDE.md` spiega come usare questi endpoint in QA (branch docs, PR, ambienti).
- `KNOWN_ISSUES.md` cataloga bug API (es. `/api/admin/contacts` 500) con passi di riproduzione.

## Provenienza & Storia
SORGENTE: `docs/_archive/ROUTES.md`, `docs/_archive/AUDIT_BACKEND.md`, `docs/_archive/DATABASE.md`  
COMMIT: 9d9f5c3 (snapshot precedente consolidamento)  
MOTIVO DELLO SPOSTAMENTO: unificazione reference backend in singolo manuale hardening 2025-02-15.  
DIFFERENZE CHIAVE: aggiunte tabelle complete (Auth/CORS/errori), esempi JSON aggiornati, schema Prisma inline; mantenuti bullet originali con aggiornamenti di stato.
