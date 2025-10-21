---
merged_from:
  - docs/DEV_GUIDE.md
  - docs/CHECKOUT_FLOW.md
  - docs/ROUTES.md
  - docs/ADMIN.md
updated: 2025-02-14
---
Aggiornato al: 2025-02-15

## Mini-TOC
- [Frontend, Routing & UX](#frontend-routing--ux)
  - [Onboarding rapido](#onboarding-rapido)
  - [Struttura repository & convenzioni](#struttura-repository--convenzioni)
  - [Debug & simulazioni](#debug--simulazioni)
  - [Checkout & prenotazioni](#checkout--prenotazioni)
  - [Routing pubblico](#routing-pubblico)
  - [Area amministrazione](#area-amministrazione)
    - [Tabella Prenotazioni](#tabella-prenotazioni)
    - [Filtri & ricerca](#filtri--ricerca)
    - [Dettaglio items evento](#dettaglio-items-evento)
    - [Refactor suggeriti](#refactor-suggeriti)
  - [Errori runtime noti](#errori-runtime-noti)
- [Riferimenti incrociati](#riferimenti-incrociati)
- [Provenienza & Storia](#provenienza--storia)

# Frontend, Routing & UX

> Questo documento sostituisce `docs/DEV_GUIDE.md`, `docs/CHECKOUT_FLOW.md`, `docs/ROUTES.md` e `docs/ADMIN.md`. Copre onboarding frontend, routing, checkout e area amministrazione.

## Onboarding rapido
1. **Prerequisiti**: Node 20+, pnpm 9+, SQLite (Prisma), accesso SMTP (Mailtrap) e Revolut sandbox.
2. `pnpm install`
3. `cp .env.example .env.local` → popolala con credenziali (`ADMIN_EMAILS`, SMTP, Revolut, Supabase).
4. `pnpm prisma db push` + `pnpm tsx prisma/seed.ts` per dati demo (catalogo prodotti, utenti admin).
5. `pnpm dev` → http://localhost:3000.

## Struttura repository & convenzioni
- `src/app` — App Router (UI pubblica, checkout, admin, API). Le cartelle `api/**` rispecchiano i path runtime.
- `src/components` — componenti condivisi (cart, booking wizard, admin UI, toast).
- `src/hooks` — hook client come `useCart` (gestione token carrello).
- `src/lib` — dominio condiviso (Prisma, mailer, Revolut, logger, paymentRef, bookingVerification).
- `src/state` — store Zustand per consenso cookie.
- `prisma` — schema, migrazioni, seed.

Convenzioni:
- Commit `feat:`, `fix:`, `docs:` dove possibile.
- Tipi: usare DTO in `src/types/**`; evitare `any`.
- API: restituire `{ ok: boolean, data?: any, error?: string }`.
- Terminologia UI: usare “prenotazione via email” per il flusso email-only.

## Debug & simulazioni
- **Storage**: DevTools → Application → Storage.
  - Cookies: `cart_token`, `order_verify_token` (httpOnly, ispezionabili lato server/Tools).
  - SessionStorage: `order_verify_token` (token verifica email).
  - LocalStorage: `lasoluzione_cart_token` (persistenza carrello).
- **Log server**: `logger.*` produce JSON (email mascherate). Controlla `paymentRef.emailError` per esito mail ordine.
- **SMTP**: usare Mailtrap/smtp4dev, verificare template booking e ordine.
- **Revolut sandbox**: per stati fittizi usare `/fake-payment?token=...` (prenotazioni legacy) o `payments/fake-confirm`.

## Checkout & prenotazioni
### Stato condiviso
- `cart_token` (cookie httpOnly): creato da `/api/cart`, identifica il carrello.
- `order_verify_token` (cookie httpOnly + sessionStorage): scritto da `/api/payments/email-verify`, necessario per completare checkout senza reinviare mail.
- `BookingVerification` DB: token email-only scade dopo 30 minuti (`expiresAt`).

### Flusso prenotazione via email (0 €)
```text
Cliente → POST /api/payments/checkout (totalCents 0)
  ├─ Valida consensi privacy/marketing
  ├─ Crea/aggiorna Booking + Order (status confirmed)
  ├─ Invia email conferma (customer + staff)
  └─ Risposta { status: 'confirmed', bookingId, orderId }

Cliente clic link email (fallback legacy): GET /api/payments/email-verify?token
  ├─ Valida token (BookingVerification)
  ├─ Aggiorna Booking.status='confirmed', Order.status='confirmed'
  └─ Redirect `/checkout/success`
```

### Flusso con pagamento Revolut
```text
/checkout (React Hook Form) → POST /api/payments/checkout
  ├─ Se manca order_verify_token → invia email verifica (status 'verify_sent')
  ├─ Se token valido → crea Hosted Order Revolut, salva paymentRef, invia mail pagamento
  └─ Risposta { status: 'paid_redirect', hostedPaymentUrl, checkoutPublicId }

/checkout/return → Poll GET /api/payments/order-status (fino a 12 tentativi)
  ├─ stato paid/completed → mostra successo, eventuale POST /api/orders/finalize
  └─ stato failed/cancelled → mostra errore, abilita retry
```

### Token & sicurezza
- Token email firmato con `NEXTAUTH_SECRET` (`signJwt`), TTL 15 minuti (`VERIFY_TOKEN_TTL_SECONDS`).
- Cookie `order_verify_token`: `httpOnly`, `SameSite=Lax`, TTL 15 min.
- Client pulisce sessionStorage dopo `verified=1` o redirect success.

## Routing pubblico
| Path | File sorgente | Accesso | Componenti chiave |
| --- | --- | --- | --- |
| `/` | `src/app/(site)/page.tsx` | Pubblica | Landing: hero, eventi, CTA prenotazione, newsletter, mappa (`src/components/home/*`). |
| `/prenota` | `src/app/prenota/page.tsx` | Pubblica | Wizard legacy + carrello se `NEXT_PUBLIC_CART_ENABLED=true`; include `CartSidebar`. |
| `/eventi/[slug]` | `src/app/eventi/[slug]/page.tsx` | Pubblica | Dettaglio evento (Prisma fetch). Mostra form email-only se `allowEmailOnlyBooking`. |
| `/checkout` | `src/app/checkout/page.tsx` | Pubblica | Form checkout (React Hook Form, Zod). Gestisce step verify, paid_redirect, confirmed. |
| `/checkout/email-sent` | `src/app/checkout/email-sent/page.tsx` | Pubblica | Conferma invio mail verifica; consente resend via `/api/bookings/resend-confirmation`. |
| `/checkout/confirm` | `src/app/checkout/confirm/page.tsx` | Pubblica | Legacy: chiama `/api/payments/email-verify` e mostra loader. |
| `/checkout/return` | `src/app/checkout/return/page.tsx` | Pubblica | Poll stato ordine + fallback error view. |
| `/checkout/cancel` | `src/app/checkout/cancel/page.tsx` | Pubblica | Messaggio annullo pagamento. |
| `/checkout/success` | `src/app/checkout/success/page.tsx` | Pubblica | Mostra ID ordine/booking, reset carrello. |
| `/fake-payment` | `src/app/fake-payment/page.tsx` | Pubblica | QA per confermare/annullare token legacy. |
| `/privacy`, `/cookie-policy` | `src/app/privacy/page.tsx`, `src/app/cookie-policy/page.tsx` | Pubblica | Informative legali (MDX). |

## Area amministrazione
### Accesso & middleware
- Configurare `.env.local` con `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, credenziali SMTP e `ADMIN_EMAILS` (separati da virgola/punto e virgola).
- Middleware Next.js (`src/_middleware.ts.off` → rinominare `middleware.ts`) forza login per `/admin/*` e API admin. Utilizza `getToken` (NextAuth JWT) + redirect a `/admin/signin?from=...`.
- Client: `AdminProviders` avvolge layout con `SessionProvider` + `Toaster`.

### Navigazione laterale
- `AdminNav` restituisce esclusivamente l'elemento `<nav>` con sezioni e link; il wrapper scuro con heading vive nel layout protetto (`src/app/admin/(protected)/layout.tsx`).
- L'intestazione laterale mostra solo "Dashboard Admin" (niente sottotitoli duplicati).
- Il link "Contatti" è fornito da `AdminNav` solo all'interno della sezione CRM; non compare più tra i link principali passati dal layout.

### Mappa pagine admin
| Path | File | Descrizione | Note UI |
| --- | --- | --- | --- |
| `/admin` | `src/app/admin/(protected)/page.tsx` | Dashboard prenotazioni (server component). | Mostra grafici TODO. |
| `/admin/bookings` | `src/app/admin/(protected)/bookings/page.tsx` | Tabella prenotazioni (client component `BookingsView`). | Filtri querystring + stampa. |
| `/admin/catalog/products` | `src/app/admin/(protected)/catalog/products/page.tsx` | CRUD prodotti (`ProductForm`). | Usa modale per create/update. |
| `/admin/catalog/sections` | `src/app/admin/(protected)/catalog/sections/page.tsx` | Gestione sezioni e ordering (`SectionsPageClient`). | Drag & drop TODO. |
| `/admin/events` | `src/app/admin/(protected)/events/page.tsx` | Lista eventi + collegamenti tier/prodotti. | Richiede completamento API search. |
| `/admin/menu/dishes` | `src/app/admin/(protected)/menu/dishes/page.tsx` | Legacy menu pranzo/cena. | Flag `NEXT_PUBLIC_ADMIN_SHOW_LEGACY`. |
| `/admin/tiers` | `src/app/admin/(protected)/tiers/page.tsx` | CRUD pacchetti evento/aperitivo. | Mostra stato attivo/draft. |
| `/admin/contacts` | `src/app/admin/(protected)/contacts/page.tsx` | Gestione contatti (`ContactsPageClient`). | Accetta payload `{ data }` o `{ items }`; `bookingsCount` usa fallback `totalBookings`; `createdAt` viene forzato a `lastContactAt` quando mancante; "Ultimo contatto" legge `lastContactAt` (fallback `createdAt`).【F:src/components/admin/contacts/ContactsPageClient.tsx†L68-L116】 |
| `/admin/settings` | `src/app/admin/(protected)/settings/page.tsx` | Configurazione `BookingSettings`. | Elenco eventi email-only (vuoto per mancanza seed). |

### Tabella Prenotazioni
| Campo | Origine | Formato UI | Regole rendering |
| --- | --- | --- | --- |
| Data/Ora | `booking.date` | `DD/MM/YYYY HH:mm` (timezone locale) | Mostrare tooltip ISO completo su hover (TODO). |
| Tipo | `booking.type` | Badge (`evento`, `aperitivo`, `pranzo`, `cena`) | Colori Tailwind: evento=indigo, aperitivo=amber, pranzo=green, cena=purple. |
| Persone | `booking.people` | Numero intero | Se `tierLabel` presente mostra `(+tierLabel)`. |
| Stato | `booking.status` | Badge `pending`, `pending_payment`, `confirmed`, `cancelled`, `failed` | `pending_payment` evidenziato in arancione per azione manuale. |
| Email/Telefono | `booking.email`, `booking.phone` | Link mailto/tel | Icone copy-to-clipboard (TODO). |
| Note | `booking.notes` | Tooltip (line-clamp 1) | Espansione modale se > 120 caratteri (TODO). |
| Tier/Prezzo | `booking.tierLabel`, `tierPriceCents` | `Tier – €xx,yy` | Se mismatch prezzo → badge warning. |
| Azioni | API admin confirm/cancel/resend | Bottoni compatti (icon button) | Suggerito allineamento orizzontale, tooltip descrittivi. |

Tabella utilizza `BookingsView` (`src/components/admin/bookings/BookingsView.tsx`) con stato React per filtri, `@tanstack/react-table` per sorting, `react-hook-form` per modale aggiornamento manuale.

### Filtri & ricerca
- Query string supportata: `status`, `type`, `dateFrom`, `dateTo`, `tier`, `search`, `page`.
- Filtri combinabili (es. `status=pending&type=evento&search=rossi`).
- Paginazione server: `page` (1-based), `pageSize=20` default.
- Ricerca full-text su `name`, `email`, `phone`. `BookingsView` mostra pill attive con possibilità di reset.
- `Reset filters` ripristina query string (router `useRouter().replace`).

### Dettaglio items evento
- API `admin/events` restituisce `items[]` (descrizioni menu) e `tierLinks`.
- UI attuale mostra JSON compatto; **migliorie consigliate**:
  - Convertire `items` in lista puntata (`<ul>`), con `title`, `description`, `price`.
  - Aggiungere tooltip su icona info con `availability` (`ALL_DAY`, `DINNER_ONLY`).
  - Introdurre modal "Dettaglio evento" con tab "Prodotti collegati" vs "Contenuti marketing".

### Refactor suggeriti
- **Bottoni compatti**: sostituire `Button variant="secondary"` con `IconButton` per azioni confirm/cancel/resend.
- **Overflow tabella**: wrapping attuale crea scroll orizzontale. Suggerire `table-layout: fixed` + `text-ellipsis` e `max-w-[160px]` su colonne note.
- **Tooltip**: uniformare con `@radix-ui/react-tooltip` (attualmente mix `title` HTML + component). Creare wrapper `AdminTooltip`.
- **Responsive**: su viewport <1024px, convertire tabella in schede (vedi `docs/RESPONSIVE_AUDIT.md`).

## Errori runtime noti
| ID | Descrizione | Riproduzione | Log richiesto | Riferimento |
| --- | --- | --- | --- | --- |
| React #418 | Hydration mismatch su tab Prenotazioni quando `cart_token` mancante. | Aprire `/admin/bookings` senza cookie, osservare warning in console. | Log `cartToken` server e fallback. | `KNOWN_ISSUES.md` P1. |
| React #423 | Error boundary su Settings quando API `/api/admin/contacts` 500. | Visitare `/admin/settings` con backend attuale. | Log fetch `contacts` + stack. | `KNOWN_ISSUES.md` P0. |
| React #425 | `Cannot read properties of undefined (reading 'items')` in Events. | `/admin/events` con eventInstance privo di `items`. | Log `eventId`, `items` null. | `KNOWN_ISSUES.md` P1. |
| UI booking items | Lista items compressa, difficile leggere. | `/admin/events/[id]` su evento con `items` JSON. | Log `items.length`, `renderTime`. | `KNOWN_ISSUES.md` P1. |

## Riferimenti incrociati
- `BACKEND.md` — per API admin e mapping Prisma ↔ UI.
- `RESPONSIVE_AUDIT.md` — suggerimenti layout mobile.
- `KNOWN_ISSUES.md` — dettagli su bug React, 500 API admin.
- `PROJECT_OVERVIEW.md` — contesto business delle sezioni UI.

## Provenienza & Storia
SORGENTE: `docs/DEV_GUIDE.md`, `docs/CHECKOUT_FLOW.md`, `docs/ROUTES.md`, `docs/ADMIN.md`
COMMIT: 9d9f5c3
MOTIVO DELLO SPOSTAMENTO: integrazione dettagli admin (colonne tabella, filtri, errori), mini-TOC e refactor suggeriti.
DIFFERENZE CHIAVE: aggiunte sezioni Tabella Prenotazioni, Filtri, Items evento, elenco errori runtime con link a `KNOWN_ISSUES.md`.
