# Routing & endpoint

## Pagine App Router (pubbliche)
| Path | File sorgente | Accesso | Descrizione / componenti chiave |
| --- | --- | --- | --- |
| `/` | `src/app/(site)/page.tsx` | Pubblica | Landing marketing: hero, eventi, CTA prenotazione, newsletter, mappa (usa componenti in `src/components/home/*`). |
| `/prenota` | `src/app/prenota/page.tsx` | Pubblica | Wizard prenotazione legacy e, se `NEXT_PUBLIC_CART_ENABLED=true`, catalogo con carrello (`CartSidebar`). |
| `/eventi/[slug]` | `src/app/eventi/[slug]/page.tsx` | Pubblica | Dettaglio evento dinamico (usa Prisma → richiede `DATABASE_URL`). Se `allowEmailOnlyBooking` abilita form email-only. |
| `/checkout` | `src/app/checkout/page.tsx` | Pubblica | Form checkout carrello (react-hook-form, zod). Gestisce stati `verify`, `paid_redirect`, `confirmed`. |
| `/checkout/email-sent` | `src/app/checkout/email-sent/page.tsx` | Pubblica | Conferma invio link email; permette reinvio tramite `/api/bookings/resend-confirmation`. |
| `/checkout/confirm` | `src/app/checkout/confirm/page.tsx` | Pubblica | Pagina di transizione che chiama `/api/payments/email-verify` e mostra loader. |
| `/checkout/return` | `src/app/checkout/return/page.tsx` | Pubblica | Poll status ordine dopo redirect provider (`/api/payments/order-status`). |
| `/checkout/cancel` | `src/app/checkout/cancel/page.tsx` | Pubblica | Esito annullamento pagamento con CTA per tornare al carrello. |
| `/checkout/success` | `src/app/checkout/success/page.tsx` | Pubblica | Conferma ordine, mostra ID booking/order e resetta token carrello. |
| `/fake-payment` | `src/app/fake-payment/page.tsx` | Pubblica | Strumento QA: permette di confermare/annullare token pagamento via API legacy fake. |
| `/privacy` | `src/app/privacy/page.tsx` | Pubblica | Informativa privacy. |
| `/cookie-policy` | `src/app/cookie-policy/page.tsx` | Pubblica | Informativa cookie, sincronizzata con `NEXT_PUBLIC_POLICY_VERSION`. |

## Area admin (protetta)
| Path | File sorgente | Accesso | Note |
| --- | --- | --- | --- |
| `/admin/signin` | `src/app/admin/signin/page.tsx` | Pubblica | Form magic link. Accetta `?from=` per redirect post-login. Mostra errori `AccessDenied` / `Configuration`. |
| `/admin/not-authorized` | `src/app/admin/not-authorized/page.tsx` | Pubblica | Pagina fallback per email non whitelisted. |
| `/admin` | `src/app/admin/(protected)/page.tsx` | Solo admin | Dashboard prenotazioni. Layout protetto (`src/app/admin/(protected)/layout.tsx`) con `auth()` server-side. |
| `/admin/bookings` | `src/app/admin/(protected)/bookings/page.tsx` | Solo admin | Lista prenotazioni, filtri e stampa (`/admin/bookings/print`). |
| `/admin/catalog/products` | `src/app/admin/(protected)/catalog/products/page.tsx` | Solo admin | Gestione prodotti (CRUD). |
| `/admin/catalog/sections` | `src/app/admin/(protected)/catalog/sections/page.tsx` | Solo admin | Configurazione sezioni catalogo (`SectionProduct`). |
| `/admin/catalog/sections/[id]` | `src/app/admin/(protected)/catalog/sections/[id]/page.tsx` | Solo admin | Dettaglio singola sezione. |
| `/admin/events` | `src/app/admin/(protected)/events/page.tsx` | Solo admin | Lista eventi e collegamenti istanze. |
| `/admin/events/[id]` | `src/app/admin/(protected)/events/[id]/page.tsx` | Solo admin | Dettaglio evento / istanza. |
| `/admin/menu/dishes` | `src/app/admin/(protected)/menu/dishes/page.tsx` | Solo admin | Gestione menu legacy (flag `NEXT_PUBLIC_ADMIN_SHOW_LEGACY` per visibilità). |
| `/admin/tiers` | `src/app/admin/(protected)/tiers/page.tsx` | Solo admin | Gestione pacchetti legacy. |
| `/admin/contacts` | `src/app/admin/(protected)/contacts/page.tsx` | Solo admin | Gestione contatti e stampa (`/admin/contacts/print`). |
| `/admin/settings` | `src/app/admin/(protected)/settings/page.tsx` | Solo admin | Configurazione `BookingSettings`. |

> Middleware: `src/middleware.ts` (vedi `src/_middleware.ts.off`) applica `matcher: ['/admin/:path*']` e richiede token NextAuth valido (`getToken`). Reindirizza a `/admin/signin?from=...`.

## API pubbliche (`/api/*`)
| Metodo | Path | Auth | Payload / Query | Risposta (principale) |
| --- | --- | --- | --- | --- |
| GET | `/api/cart` | Nessuna | Query `token` opzionale, cookie `cart_token` | `{ ok: true, data: CartDTO }` e refresh cookie se necessario. |
| POST | `/api/cart` | Nessuna | `{ token?: string }` | Restituisce DTO carrello e imposta cookie. |
| POST | `/api/orders` | Nessuna | `{ cartId, email, name, phone, notes? }` | Crea ordine collegato al carrello, ritorna `{ ok, data: { orderId, status, ... } }`. |
| POST | `/api/orders/finalize` | Nessuna | `{ orderId }` | Marca ordine come `paid/confirmed` (usato da hosted checkout). |
| POST | `/api/payments/checkout` | Nessuna | `{ email, name, phone, agreePrivacy, agreeMarketing, items[], verifyToken? }` | Stati `verify_sent` / `confirmed` / `paid_redirect`, eventuale `hostedPaymentUrl`. |
| GET | `/api/payments/email-verify` | Nessuna | `?token=` | Redirect 302 → `/checkout?verified=1` o `/checkout/success`, imposta cookie `order_verify_token`. |
| GET | `/api/payments/order-status` | Nessuna | `?orderId=` o `?ref=` | `{ ok: true, data: { status, orderId } }`. |
| POST | `/api/bookings` | Nessuna | Payload legacy prenotazione (tipo, data, persone, menu, consensi) | `{ ok: true, data: { bookingId } }` o errori `requiresPrepay`, `tier_unavailable`. |
| POST | `/api/bookings/email-only` | Nessuna | `{ eventSlug|eventInstanceId, people, customer{name,email,phone}, notes?, agreePrivacy, agreeMarketing }` | `{ ok: true, data: { bookingId, verificationToken } }`. |
| POST | `/api/bookings/resend-confirmation` | Nessuna | `{ bookingId }` | Reinvia email di verifica (`429` se rate limit). |
| POST | `/api/bookings/fake-confirm` | Nessuna (solo QA) | `{ token }` | Conferma token email-only (solo sviluppo). |
| POST | `/api/bookings/fake-cancel` | Nessuna | `{ token }` | Annulla token email-only (solo sviluppo). |
| GET | `/api/booking-config` | Nessuna | — | Config booking (menu, settings, tiers). |
| GET | `/api/catalog` | Nessuna | `?section=` opzionale | Catalogo + prodotti attivi. |
| GET | `/api/events` | Nessuna | — | Lista eventi/istanze attive per la landing. |
| POST | `/api/newsletter` | Nessuna | `{ email }` | `{ ok: true }` o `400 invalid_email`, `409 already_confirmed`. |
| GET | `/api/ping` | Nessuna | — | `{ ok: true, ts }` healthcheck semplice. |

## API Auth & Admin
| Metodo | Path | Auth | Payload / Query | Note |
| --- | --- | --- | --- | --- |
| GET/POST | `/api/auth/[...nextauth]` | NextAuth gestisce | Form-data email provider | Espone endpoint `signIn`, `callback` ecc. Runtime `nodejs`, `dynamic = 'force-dynamic'`. |
| GET | `/api/admin/_whoami` | Solo sviluppo | Cookie sessione admin | Restituisce whitelist attuale e env (disabilitato in produzione). |
| GET/POST | `/api/admin/bookings` | Richiede sessione admin | Filtri e update prenotazioni | Ogni route in `src/app/api/admin/bookings/*` utilizza Prisma (CRUD, export). |
| GET/POST | `/api/admin/products` | Richiede sessione admin | CRUD prodotti catalogo | Gestisce `Product` e `SectionProduct`. |
| GET/POST | `/api/admin/sections` | Richiede sessione admin | Assegnazioni sezione-prodotti | Gestisce ordering e featured. |
| GET/POST | `/api/admin/events` | Richiede sessione admin | CRUD eventi (`EventInstance`, `EventItem`) | Supporto a email-only toggle. |
| GET/POST | `/api/admin/tiers` | Richiede sessione admin | CRUD `EventTier` legacy | Usato per sincronizzare con `Product` via seed. |
| GET/POST | `/api/admin/contacts` | Richiede sessione admin | Gestione lead (list, export) | Include endpoint stampa PDF/CSV lato server. |
| GET/POST | `/api/admin/settings` | Richiede sessione admin | Booking settings | Aggiorna `BookingSettings` (cover, prepay). |

## Convenzioni
- Le API restituite manualmente seguono schema `{ ok: boolean, data?: any, error?: string }`. Errori di validazione Zod includono `details`.
- Tutte le rotte admin (pagine e API) dipendono dalla sessione JWT NextAuth; il middleware è l'unico punto che redirige.
- Cookie principali: `cart_token` (persistenza carrello, `httpOnly`, `sameSite=lax`) e `order_verify_token` (verifica email checkout).
