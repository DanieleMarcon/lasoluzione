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
