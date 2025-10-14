---
merged_from:
  - docs/DEV_GUIDE.md
  - docs/CHECKOUT_FLOW.md
  - docs/ROUTES.md
  - docs/ADMIN.md
updated: 2025-02-14
---
# Frontend, Routing & UX

> Questo documento sostituisce `docs/DEV_GUIDE.md`, `docs/CHECKOUT_FLOW.md`, `docs/ROUTES.md` e `docs/ADMIN.md`. Copre onboarding frontend, routing, checkout e area amministrazione.

## Guida sviluppo e convenzioni

## Onboarding rapido
1. **Prerequisiti**: Node 20+, pnpm 9+, SQLite (gestito via Prisma), accesso a Mailtrap/Revolut sandbox.
2. `pnpm install`
3. `cp .env.example .env.local` e aggiorna secret/auth/SMTP/Revolut.
4. `pnpm prisma db push` + `pnpm tsx prisma/seed.ts` per popolare dati demo.
5. `pnpm dev` → http://localhost:3000.

## Struttura repository
- `src/app` — App Router (UI pubblica, checkout, admin, API). Cartelle `api/**` seguono lo stesso path della rotta.
- `src/components` — componenti condivisi (cart, booking wizard, admin UI).
- `src/hooks` — hook client (`useCart`).
- `src/lib` — layer dominio (Prisma, mailer, Revolut, JWT, logger, paymentRef, bookingVerification, cookies, ecc.).
- `src/state` — store Zustand per consenso cookie.
- `prisma` — schema, migrations, seed.

## Convenzioni
- **Commit**: formato libero ma preferire `feat:`, `fix:`, `docs:` quando possibile.
- **TypeScript**: evitare `any` se non strettamente necessario; preferire DTO (`src/types/**`).
- **API**: restituire sempre `{ ok: boolean }` + `error` string per uniformità.
- **Email-only**: usare terminologia “prenotazione via email” in UI e documenti.

## Debugging
- **Storage**: in Chrome DevTools → Application → Storage
  - Cookies: `cart_token`, `order_verify_token` (httpOnly → ispezionabili via Application → Cookies).
  - SessionStorage: chiave `order_verify_token` (solo lato client).
  - LocalStorage: `lasoluzione_cart_token` (token carrello usato da `useCart`).
- **Log server**: `logger.*` stampa JSON (maschera email); controlla `emailError` dentro `paymentRef` per esito invio pagamento.
- **SMTP**: usa Mailtrap/smtp4dev e monitora l’inbox per verificare template.
- **Revolut sandbox**: se vuoi forzare stati, puoi usare il fake payment `/fake-payment?token=...` su prenotazioni legacy.

## Simulare stati
- **Forzare verifica email**: recupera token `order_verify_token` dal cookie (solo via server) oppure genera un nuovo link chiamando `POST /api/payments/checkout` con payload valido (verrà re-inviata la mail).
- **Prenotazione email-only manuale**: usa `POST /api/bookings/email-only` con `eventSlug`, `people` e consensi; controlla la mail di verifica e apri il link.
- **Ordine pagato**: dopo aver completato il pagamento sandbox, chiama `POST /api/orders/finalize` con `orderId` per simulare conferma lato dominio.

## Testing manuale
- Checkout → completare i tre rami: `verify_sent` (senza conferma), `confirmed` (email-only), `paid_redirect` (pagamento).
- Admin → verifica che il middleware reindirizzi utenti non whitelisted su `/admin/not-authorized`.
- Consent banner → prova toggle categorie e verifica cookie `lasoluzione_cookie_consent`.

## Accesso admin
- Popola `ADMIN_EMAILS` con il tuo indirizzo.
- Richiedi magic link da `/admin/signin` (necessita SMTP funzionante). Il middleware `src/middleware.ts` blocca anche le API `/api/admin/*`.

## Checkout flow

## Stato condiviso
- Cookie HTTP-only `cart_token`: creato da `/api/cart`, identifica il carrello e viene letto da API checkout.
- Cookie HTTP-only `order_verify_token`: impostato da `/api/payments/email-verify` (solo quando l’email è verificata) e letto da `/api/payments/checkout` per saltare il passaggio di verifica.
- SessionStorage `order_verify_token`: la pagina `/checkout` salva qui il token ricevuto da `POST /api/payments/checkout` (`state: 'verify_sent'`) per mostrarne lo stato.

## Flusso “prenotazione via email” (totale 0€)
```
Cliente ↦ POST /api/payments/checkout
  ├─ verifica consenso privacy obbligatorio
  ├─ cart status → recalc totale = 0 → stato ordine 'pending'
  ├─ issueBookingToken (BookingVerification) + sendBookingVerifyEmail
  └─ risposta { state: 'confirmed', bookingId, orderId, nextUrl }
        (non viene generato token verify lato checkout perché conferma immediata)

Email cliente: link Conferma → GET /api/payments/email-verify?token=...
  ├─ Valida token (consumeBookingToken)
  ├─ Aggiorna Booking.status='confirmed', Order.status='confirmed', Cart.status='locked'
  └─ Redirect a `/checkout/success?orderId=...&bookingId=...` dopo `/api/payments/email-verify`
```
Nel nuovo flusso email-only collegato al carrello (API `email-verify`):
```
POST /api/payments/checkout (totale 0) ─┐
                                       ▼
                       Booking creato/aggiornato + mail verify
                                       ▼
Cliente clicca link email → GET /api/payments/email-verify?token
  ├─ Valida token + carica cart/order
  ├─ Determina se email-only: se `cart.totalCents <= 0` o meta `emailOnly`
  ├─ Aggiorna Booking.status='confirmed', Order.status='confirmed', Cart.status='locked'
  ├─ Invia `sendBookingConfirmedCustomer` + `sendBookingConfirmedAdmin`
  └─ Redirect a `/checkout/success?orderId=...&bookingId=...`
```

## Flusso con pagamento Revolut
```
Cliente compila /checkout → POST /api/payments/checkout
  ├─ Valida carrello e crea/aggiorna Order (status 'pending_payment')
  ├─ Se manca verifyToken, invia mail verify (state 'verify_sent') e termina
  ├─ Se verifyToken valido (cookie + body), continua:
        • Aggiorna consensi marketing
        • Chiama createRevolutOrder → ottiene hostedPaymentUrl e checkoutPublicId
        • Invia sendOrderPaymentEmail (logga esito in paymentRef)
        • Risposta { state: 'paid_redirect', url: hostedPaymentUrl, email: { ok|error } }

Cliente viene reindirizzato da Revolut → /checkout/return?orderId=...
  ├─ Frontend effettua polling GET /api/payments/order-status
  ├─ Se stato `paid/completed` chiama opzionalmente POST /api/orders/finalize (non automatico) e redirect success
  └─ Se `failed/cancelled` mostra errore e invita a riprovare
```

## Stati server
- `verify_sent`: ordine creato, email verifica inviata. Nessuna prenotazione ancora confermata.
- `confirmed`: ordine confermato senza pagamento (email-only). Cart bloccato e booking associato.
- `paid_redirect`: ordine necessita pagamento esterno; risposta include `url` (hosted page) e `checkoutPublicId` per eventuale widget.

## Token e sicurezza
- Token email viene firmato con `signJwt` (`NEXTAUTH_SECRET`) e dura 15 minuti (`VERIFY_TOKEN_TTL_SECONDS`).
- `/api/payments/email-verify` imposta cookie `order_verify_token` valido 15 minuti (httpOnly, `sameSite=lax`), necessario per completare checkout senza reinviare mail.
- SessionStorage viene pulito dal client una volta ricevuto `verified=1` o dopo redirect success.

## Routing pubblico e API

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

## Area amministrazione

## Accesso
- Configura `.env.local` con `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, credenziali SMTP e `ADMIN_EMAILS` (lista separata da virgole o punto e virgola).
- Avvia `pnpm dev`, visita `/admin/signin`, inserisci un indirizzo autorizzato e conferma il magic link ricevuto.
- In locale è disponibile `/api/admin/_whoami` per verificare la sessione (solo dev).

## Sommario rapido Eventi & Contatti
- **Eventi** → `/admin/events`: crea/modifica istanze `EventInstance`, abilita la prenotazione “email-only” e gestisci i pacchetti collegati.
- **Contatti** → `/admin/contacts`: vista CRM deduplicata con esportazione CSV, filtri su consensi privacy/newsletter e stampa rapida per il personale di sala.

## Indice sezioni admin
| Percorso | Stato | Descrizione sintetica |
| --- | --- | --- |
| `/admin` | legacy | Dashboard prenotazioni e riepilogo rapide. |
| `/admin/bookings` | legacy | Gestione prenotazioni (filtri, conferme, email). |
| `/admin/menu/dishes` | legacy | CRUD piatti pranzo legacy. |
| `/admin/tiers` | legacy | Gestione pacchetti evento legacy. |
| `/admin/settings` | legacy | Configurazioni `BookingSettings` (coperti, prepay, tipi attivi). |
| `/admin/catalog/products` | nuovo | Catalogo prodotti unificato: create/edit, flag nutrizionali, toggle attivo, slug auto. |
| `/admin/catalog/sections` | nuovo | Attiva/disattiva sezione, `enableDateTime` **solo** per `pranzo`/`cena`, displayOrder e assegnazioni prodotto (featured/home). |
| `/admin/events` | nuovo | Lista Eventi con form creazione, toggle visibilità/home/email-only e gestione pacchetti collegati. |
| `/admin/contacts` | nuovo | CRM contatti deduplicati per email, consensi, storico prenotazioni, esport CSV. |

### Voci legacy

Le voci “Piatti pranzo (Legacy)” e “Opzioni evento/aperitivo (Legacy)” sono nascoste di default. Per riabilitarle in ambienti di migrazione impostare `NEXT_PUBLIC_ADMIN_SHOW_LEGACY=true`.

## Catalogo prodotti
- Lista paginata con ricerca full-text e filtri per categoria/stato.
- Form creazione/modifica: campi descrittivi, prezzo in centesimi, flag nutrizionali (`isVegan`, `containsAlcohol`, ecc.).
- Slug generato automaticamente se non fornito; conflitti restituiscono toast d’errore.
- Azioni: attiva/disattiva prodotto, duplica dati nel form per editing, rimozione (soft toggle `active`).

## Catalogo sezioni
- Tabella sezioni con toggle `active` e ordine (`displayOrder`).
- Pulsante **Abilita data/ora** attivo esclusivamente per le sezioni `pranzo` e `cena`; altrove il bottone resta disabilitato con tooltip esplicativo.
- Modale assegnazioni: ricerca prodotto, impostazione `featured`, `showInHome`, `order` pivot.
- Bottone “Rimuovi” richiede conferma browser prima di chiamare l’API DELETE.

## Eventi
- **Quick start**
  1. Visita `/admin/events` per ottenere la lista paginata filtrabile (stato + ricerca su titolo/slug).
  2. Compila il form in cima alla pagina con titolo, slug e date; spunta **Prenotazione email-only** se vuoi esporre il form pubblico senza pagamento.
  3. Dopo la creazione clicca sul titolo per accedere al dettaglio e gestire i **Pacchetti** (etichetta, prezzo, stato attivo). I pacchetti attivi appaiono automaticamente nel form pubblico come select opzionale.
  4. Usa i toggle **Attivo**/**Mostra in home** per controllare visibilità e promozione; elimina o sospendi gli eventi obsoleti.
- Percorso: `/admin/events` (voce nel menu Catalogo).
- Form in cima alla pagina per creare una nuova `EventInstance` con i campi obbligatori: **Titolo**, **Slug** (minuscolo/kebab-case, validato), **Data inizio** (`startAt` ISO) e flag booleani **Attivo**, **Mostra in home**, **Prenotazione email-only**. Campi opzionali: **Data fine** (`endAt`, deve essere successiva all'inizio), **Descrizione** (max 2000 caratteri) e **Capacità** (intero ≥ 1 oppure vuoto per `null`).
- Le richieste client usano `fetch(..., { cache: 'no-store' })`; il backend valida tutto con Zod e blocca slug duplicati o range data incoerenti.
- Tabella paginata (ordinamento cronologico crescente) con colonne **Titolo**, **Data**, **Slug**, **Attivo**, **Home**, **Email-only** e **Azioni**. Il bottone **Modifica** apre l’editor inline con tutti i campi; **Salva** invia `PATCH /api/admin/events/{id}` e mostra toast di successo/errore.
- Filtri: barra di ricerca (slug/titolo), select per stato (`tutti` / `solo attivi` / `solo sospesi`) e paginazione lato server (`page`, `size`). I risultati vengono ricaricati via API con toast in caso di problemi.
- Azione **Elimina** chiama `DELETE /api/admin/events/{id}`. In caso di vincoli FK l’API effettua fallback soft (set `active=false`) e mostra toast "Evento disattivato".

### Pacchetti evento
- Dalla lista eventi clicca su un elemento per aprire la pagina dettaglio `/admin/events/{id}`.
- Header con titolo, slug, data e pulsante “Apri pubblico” che apre `/eventi/{slug}` in nuova scheda.
- Sezione **Pacchetti**: form “Nuovo pacchetto” con campi etichetta (min 2 caratteri), descrizione opzionale, prezzo in euro, ordine numerico e checkbox attivo.
- L’elenco sottostante mostra i pacchetti esistenti in ordine crescente, con campi editabili inline, prezzo formattato in euro, toggle attivo e azioni **Salva**/**Elimina**.
- Le chiamate usano le rotte: `GET/POST /api/admin/events/{id}/tiers`, `PATCH/DELETE /api/admin/events/tiers/{tierId}` (richiedono `eventId` nel payload per verificare l’appartenenza).
- Tutte le azioni mostrano toast di successo/errore e il salvataggio ricarica la lista corrente.

## Flow Toast Provider
- Provider comune: `src/components/admin/ui/toast.tsx` esporta `<ToastProvider>` e hook `useToast()`.
- Le pagine server-side montano il provider attorno ai client component (`ProductsPageClient`, `SectionsPageClient`).
- Regole: usare `useToast()` solo sotto il provider; i messaggi hanno durata ~3,5 s e si distinguono per variante (`success`, `error`, `info`).

## Sicurezza
- Tutte le rotte `/admin/*` e `/api/admin/*` passano dal middleware Auth.js; utenti non autorizzati vengono reindirizzati a `/admin/signin`.
- Le chiamate fetch dal client admin impostano `cache: 'no-store'` per evitare dati obsoleti.
---

## [P6] Aggiornamenti area Admin

### Prenotazioni
- **Esporta CSV**: pulsante “Esporta CSV” scarica un file con gli stessi filtri correnti.  
  Endpoint: `GET /api/admin/bookings/export?search=...&type=...&status=...&from=...&to=...`
  Colonne incluse: `id,date,type,status,people,name,email,phone,notes,agreePrivacy,agreeMarketing,createdAt`.
- **Nuove colonne**:
  - **Privacy**: ✅ se il cliente ha accettato i termini, altrimenti —.
  - **News**: ✅ se il cliente ha scelto l’iscrizione newsletter, altrimenti —.

### Impostazioni
- **Eventi – prenotazione via email**: elenco istanze evento; il seed crea `capodanno-2025` con toggle ON.
=======

## Prenotazioni
- In `/admin/prenotazioni` è disponibile il bottone **Esporta CSV** accanto a “Stampa elenco”; applica i filtri correnti.
- Rotta tecnica: `GET /api/admin/bookings/export`.
- Parametri supportati (`query`): `search`, `type`, `status`, `from`, `to` (identici ai filtri della lista).
- Colonne esportate in ordine: `id`, `date`, `type`, `status`, `people`, `name`, `email`, `phone`, `notes`, `agreePrivacy`, `agreeMarketing`, `createdAt`.
- Formato: date in ISO 8601 (`toISOString()`), booleani come `TRUE`/`FALSE`, valori testuali sanitizzati (virgolette raddoppiate, newline rimossi).

### Aggiornamenti export Prenotazioni (post-audit)
- Il download genera ora il file `bookings.csv`, coerente con il contenuto esportato.
- Le colonne “Privacy” e “News” mostrano i consensi salvati (`TRUE`/`FALSE` nell'export, badge ✅/— nella UI).

## Contatti
- **Quick start**
  1. Accedi a `/admin/contacts` per la lista deduplicata (una riga per email normalizzata) con colonne su consensi e numero prenotazioni.
  2. Applica i filtri `Privacy`, `Newsletter`, intervallo data e testo libero per segmentare; i risultati vengono ricalcolati lato server.
  3. Stampa la vista dedicata con **Stampa** oppure scarica l’elenco filtrato con **Esporta CSV** per importarlo in altri sistemi CRM/marketing.
- Percorso: `/admin/contacts` (voce "CRM" nella sidebar).
- Elenco deduplicato per email (normalizzate `trim` + lowercase); mostra nome, email, telefono, ultimo consenso privacy/newsletter e numero totale di prenotazioni per quell'indirizzo.
- Filtri disponibili: ricerca full-text (nome/email/telefono), selettori Privacy e Newsletter (tutti/solo sì/solo no), intervallo data creazione (`from`/`to`). Paginazione server-side (20 elementi per pagina).
- Azioni principali: **Stampa** apre `/admin/contacts/print` con layout tipografico, **Esporta CSV** scarica `contacts.csv` mantenendo gli stessi filtri.
- Endpoint esportazione: `GET /api/admin/contacts/export` con query `search`, `newsletter`, `privacy`, `from`, `to`. Colonne in ordine: `name,email,phone,createdAt,agreePrivacy,agreeMarketing,totalBookings` (ISO 8601 per date, booleani `TRUE`/`FALSE`, valori testuali sanitizzati).

## Cronologia merge
- Contenuti originali: `docs/DEV_GUIDE.md`, `docs/CHECKOUT_FLOW.md`, `docs/ROUTES.md`, `docs/ADMIN.md` (ottobre 2025).
