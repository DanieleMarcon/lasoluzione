---
updated: 2025-10-14
---
# Known Issues & Fix Log

## 2025-10-14 – Admin contacts API 500
- **Sintomo**: chiamando `GET /api/admin/contacts` la piattaforma restituiva 500 sia con utente non autenticato sia con querystring valide.
- **Root cause**: l'handler sollevava `AdminUnauthorizedError` senza intercettarla; Next.js propagava l'eccezione come 500 generico invece di `401/403`. In più la risposta esponeva `{ data, meta }` non allineato ai consumer e mancava la paginazione standard `page/pageSize/total`.
- **Fix**:
  - intercettato `AdminUnauthorizedError` e restituito `401` esplicito con payload JSON minimale;【F:src/app/api/admin/contacts/route.ts†L4-L36】
  - uniformata la query Prisma (`fetchContactsData`) e la conta totale sfruttando i filtri condivisi, con ordinamento `createdAt DESC`; risultato restituito come `{ items, page, pageSize, total, totalPages }` con clamp su `pageSize ≤ 100`;【F:src/app/api/admin/contacts/route.ts†L16-L41】
  - preferenza al filtro `q` (fallback `search`) e normalizzazione dei consensi/date nella costruzione della `WHERE` clause; copertura test con Node test runner;【F:src/lib/admin/contacts-query.ts†L5-L118】【F:tests/contacts-query.test.ts†L1-L87】
- **Follow-up**: valutare export CSV e pagina stampa per uniformare la querystring (`q`) e propagare lo stesso DTO; completare osservabilità (log structured) per errori Prisma futuri.
Aggiornato al: 2025-02-15

## 2025-10-15 – View mancante per contatti admin
- **Sintomo**: `GET /api/admin/contacts` risponde `501` con payload `{ ok:false, code:'MISSING_VIEW' }` su ambienti senza vista.
- **Root cause**: la vista materializzata `public.admin_contacts_view` non è stata creata o pubblicata nel database Postgres.
- **Fix**:
  - usare `GET /api/admin/contacts/_debug` per verificare presenza vista e righe di esempio;【F:src/app/api/admin/contacts/_debug/route.ts†L1-L89】
  - creare la vista con lo script SQL condiviso in infra (colonne attese `full_name,email,phone,last_contact_at,privacy_consent,newsletter_optin,bookings_count`).【F:src/app/api/admin/contacts/_debug/route.ts†L15-L28】
- **Follow-up**: aggiungere migrazione o task IaC che garantisca la creazione della vista su staging/produzione.

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
| API-500-Contacts | `/api/admin/contacts` restituisce 500. | `GET https://<preview>/api/admin/contacts` con sessione admin oppure aprire `/admin/contacts`. | Rotta interroga tabella non migrata (`prisma.contacts` assente). | Log Prisma (`error.code`, `query`), stack trace completo. Annotare `requestId`. | **P0** |
| API-EmailOnly-Seed | Lista eventi email-only in `/admin/settings` vuota. | Aprire `/admin/settings` → sezione "Eventi prenotazione via email". | Nessun seed `EventInstance`; API supporta solo PATCH. | Log query `fetchAdminEventInstances`, output array. | **P1** |

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
