---
updated: 2025-10-15
---
# Known Issues & Fix Log

## 2025-10-22 – Admin contacts count NULL limit/offset – risolto
- **Sintomo**: `GET /api/admin/contacts` restituiva 500 quando `page`/`pageSize` venivano passati alla funzione Supabase come `NULL` (conteggio totale).
- **Root cause**: la query `count(*)` usava `NULL` su parametri `_limit`/`_offset`, generando errore Postgres.
- **Fix**:
  - conteggio spostato in subquery (`select 1 from admin_contacts_search(...)`) con stessi filtri ma senza `NULL` sui parametri numerici.【F:src/lib/admin/contacts-service.ts†L56-L78】
  - normalizzazione coerente dei filtri `newsletter`/`privacy` (`yes`\|`no`\|`all`) e delle date `from`/`to` (`null` se invalide).【F:src/app/api/admin/contacts/route.ts†L1-L63】
  - export CSV/JSON riusa gli stessi helper e mapping DTO dell'endpoint principale per evitare divergenze.【F:src/app/api/admin/contacts/export/route.ts†L1-L110】
- **Regression note**: evitare di passare `NULL` a parametri numerici (`limit`, `offset`) quando si invocano funzioni SQL che li aspettano valorizzati.
Aggiornato al: 2025-10-22

## 2025-10-14 – Admin contacts API 500
- **Sintomo**: chiamando `GET /api/admin/contacts` la piattaforma restituiva 500 sia con utente non autenticato sia con querystring valide.
- **Root cause**: l'handler sollevava `AdminUnauthorizedError` senza intercettarla; Next.js propagava l'eccezione come 500 generico invece di `401/403`. In più la risposta esponeva `{ data, meta }` non allineato ai consumer e mancava la paginazione standard `page/pageSize/total`.
- **Fix**:
-  - interfaccia a Supabase: i wrapper condivisi (`queryAdminContacts`) invocano `public.admin_contacts_search` via `Prisma.sql` con parametri bindati e conteggio separato; niente più `$queryRawUnsafe`.【F:src/lib/admin/contacts-service.ts†L1-L78】
-  - l'API gestisce eccezioni Prisma restituendo sempre `200` con `error: "temporary_failure"`, e la UI admin mostra un banner giallo mantenendo la tabella vuota ma consistente.【F:src/app/api/admin/contacts/route.ts†L4-L51】【F:src/components/admin/contacts/ContactsPageClient.tsx†L114-L233】
-  - vista stampa ed export CSV riusano gli stessi filtri sanificati, con limiti custom ma clampati per evitare carichi eccessivi sulla view Supabase.【F:src/app/admin/(protected)/contacts/print/page.tsx†L1-L211】【F:src/app/api/admin/contacts/export/route.ts†L1-L114】
- **Follow-up**: monitorare versioni della funzione Supabase (`admin_contacts_search`) e aggiungere logging strutturato per failure future.
Aggiornato al: 2025-10-15

## 2025-10-20 – Contacts API/Client contract mismatch – risolto con normalizzazione lato client
- **Sintomo**: la pagina Admin → Contatti mostrava "Dati temporaneamente non disponibili" e console error da `payload.items` undefined.
- **Root cause**: la route `/api/admin/contacts` restituiva `{ data, total, page, pageSize }` con campi snake_case (`created_at`, `agree_privacy`, ...), mentre il client si aspettava `{ items, ... }` camelCase.
- **Fix**: normalizzazione lato client con fallback `items/data`, mapping snake_case→camelCase e rendering difensivo su array mancanti.
- **Storico**: API/Client timestamp field mismatch risolto con normalizzazione lato client.
- **Follow-up**: valutare contratto API stabile e includere schema Zod condiviso tra server e client per evitare regressioni future.
Aggiornato al: 2025-10-20

## Mini-TOC
- [Known Issues — La Soluzione](#known-issues--la-soluzione)
  - [API & Backend](#api--backend)
  - [Frontend & Admin UI](#frontend--admin-ui)
  - [Pagamenti & Checkout](#pagamenti--checkout)
  - [Database & Tipizzazione](#database--tipizzazione)
- [Riferimenti incrociati](#riferimenti-incrociati)
- [Provenienza & Storia](#provenienza--storia)

# Known Issues — La Soluzione
Ogni issue include **riproduzione**, **causa ipotizzata**, **log da raccogliere** e **priorità**.

## API & Backend
| ID | Descrizione | Riproduzione | Ipotesi causa | Log richiesti | Priorità |
| --- | --- | --- | --- | --- | --- |
| API-EmailOnly-Seed | Lista eventi email-only in `/admin/settings` vuota. | Aprire `/admin/settings` → sezione "Eventi prenotazione via email". | Nessun seed `EventInstance`; API supporta solo PATCH. | Log query `fetchAdminEventInstances`, output array. | **P1** |

> Nota: `API-500-Contacts` è stato chiuso il 2025-10-22 (vedi sezione fix log dedicata) grazie al conteggio senza `NULL` su `limit`/`offset`.

## Frontend & Admin UI
| ID | Descrizione | Riproduzione | Ipotesi causa | Log richiesti | Priorità |
| --- | --- | --- | --- | --- | --- |
| FE-React-418 | Warning hydration "Text content does not match" su `/admin/bookings`. | Aprire `/admin/bookings` senza cookie `cart_token`. | Server render differisce da client per token mancante; `BookingsView` legge cookie lato client. | Console log `cartToken`, props `initialCart`. | **P1** |
| FE-React-423 | Error boundary Settings: `Cannot read properties of undefined (reading 'map')`. | `/admin/settings` con backend attuale. | `contacts` fetch fallisce (500) ma UI non gestisce `undefined`. | Stack trace React, `response.status`. | **P0** |
| FE-React-425 | `Cannot read properties of undefined (reading 'items')` in `/admin/events`. | Aprire evento senza `items`. | UI assume `items` sempre array; API può restituire `null`. | `console.error`, payload `event`. | **P1** |
| FE-UI-Items | Lista items evento illegibile. | `/admin/events/[id]` con `items` JSON. | Rendering raw JSON senza formatting. | Screenshot UI, `items.length`. | **P2** |

## Pagamenti & Checkout
| ID | Descrizione | Riproduzione | Ipotesi causa | Log richiesti | Priorità |
| --- | --- | --- | --- | --- | --- |
| PAY-Timeout-Poll | Polling `/api/payments/order-status` resta `pending` oltre 60s. | Completare checkout sandbox e simulare ritardo Revolut. | Mancanza webhook; polling limita a 12 tentativi. | Log `pollCount`, `responseId` Revolut, timestamp. | **P1** |
| PAY-EmailRetry | Email conferma ordine a volte non inviata. | Monitorare log `sendOrderPaidEmail`. | SMTP `MAIL_FROM` errato o credenziali scadute. | Log `mailerError`, `smtpHost`, `bookingId`. | **P2** |

## Database & Tipizzazione
| ID | Descrizione | Riproduzione | Ipotesi causa | Log richiesti | Priorità |
| --- | --- | --- | --- | --- | --- |
| DB-DateString | Tipi Date vs string nell’admin. | `/admin/bookings` → export → confrontare con UI. | DTO converte `Date` in string ISO ma component si aspetta `Date`. | Console log `typeof booking.date`, stack convertitore. | **P1** |
| DB-RLS | Nessuna policy RLS Supabase documentata. | Review config DB. | In attesa definizione. | Log accessi Supabase, ruoli. | **P2** |

## Riferimenti incrociati
- `BACKEND.md` — per analizzare rotte coinvolte (es. `/api/admin/contacts`).
- `FRONTEND.md` — dettaglio componenti interessati (BookingsView, SettingsForm, Events UI).
- `PAYMENTS.md` — flusso polling Revolut, suggerimenti webhook.
- `ROADMAP.md` — priorità e milestone di mitigazione.

## Provenienza & Storia
SORGENTE: Nuovo consolidamento (issue provenienti da audit ottobre 2025)  
COMMIT: 9d9f5c3  
MOTIVO DELLO SPOSTAMENTO: centralizzare bug riproducibili con priorità e log richiesti.  
DIFFERENZE CHIAVE: n/d (documento creato ex novo, integrato con riferimenti incrociati).
