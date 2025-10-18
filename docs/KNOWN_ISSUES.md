---
updated: 2025-10-15
---
# Known Issues & Fix Log

## Risolti

### 2025-10-15 – Contacts 500 (OFFSET)
- **Sintomo**: la chiamata `GET /api/admin/contacts?page=1&pageSize=20` falliva con `500` in produzione; nei log Postgres compariva `ERROR: syntax error at or near "OFFSET" (42601)`.
- **Root cause**: l'handler costruiva manualmente l'SQL via `$queryRawUnsafe`, concatenando `OFFSET` prima di `LIMIT` e interpolando direttamente la clausola `WHERE`, con rischio injection e comportamento diverso fra driver.
- **Fix**:
  - validati `page`/`pageSize` con clamp a 200 e calcolo `offset`; filtri `q/search`, `privacy`, `newsletter`, `from`, `to` tradotti in frammenti `Prisma.sql` riutilizzabili per data e conteggio.【F:src/app/api/admin/contacts/route.ts†L44-L118】
  - riscritta la query in CTE `WITH base AS (...)` usando `$queryRaw` parametrico e ordine obbligatorio `ORDER BY last_contact_at DESC LIMIT … OFFSET …`; conteggio separato con stessa `WHERE`.【F:src/app/api/admin/contacts/route.ts†L120-L164】
  - risposta normalizzata in `{ data, page, pageSize, total, hasNextPage, hasPrevPage }` con gestione errori `{ error: "ContactsQueryFailed", detail }` e log server-side.【F:src/app/api/admin/contacts/route.ts†L166-L193】
- **Follow-up**: valutare refactoring condiviso con export/print per evitare duplicazione della CTE e introdurre osservabilità strutturata lato admin.

### 2025-10-14 – Admin contacts API 500
- **Sintomo**: chiamando `GET /api/admin/contacts` la piattaforma restituiva 500 sia con utente non autenticato sia con querystring valide.
- **Root cause**: l'handler sollevava `AdminUnauthorizedError` senza intercettarla; Next.js propagava l'eccezione come 500 generico invece di `401/403`. In più la risposta esponeva `{ data, meta }` non allineato ai consumer e mancava la paginazione standard `page/pageSize/total`.
- **Fix**:
  - intercettato `AdminUnauthorizedError` e restituito `401` esplicito con payload JSON minimale;【F:src/app/api/admin/contacts/route.ts†L4-L36】
  - uniformata la query Prisma (`fetchContactsData`) e la conta totale sfruttando i filtri condivisi, con ordinamento `createdAt DESC`; risultato restituito come `{ items, page, pageSize, total, totalPages }` con clamp su `pageSize ≤ 100`;【F:src/app/api/admin/contacts/route.ts†L16-L41】
  - preferenza al filtro `q` (fallback `search`) e normalizzazione dei consensi/date nella costruzione della `WHERE` clause; copertura test con Node test runner;【F:src/lib/admin/contacts-query.ts†L5-L118】【F:tests/contacts-query.test.ts†L1-L87】
- **Follow-up**: valutare export CSV e pagina stampa per uniformare la querystring (`q`) e propagare lo stesso DTO; completare osservabilità (log structured) per errori Prisma futuri.
