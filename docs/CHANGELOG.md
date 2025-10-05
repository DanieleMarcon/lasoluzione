# Changelog

## v0.2.0 – Catalogo fase 1 (ottobre 2025)
- Schema Prisma esteso con `Product`, `CatalogSection`, `SectionProduct`, `EventInstance`, `Cart`, `CartItem`, `Order`.
- Nuove pagine admin: `/admin/catalog/products` e `/admin/catalog/sections` con ToastProvider condiviso.
- Endpoint pubblico `GET /api/catalog` e suite admin `GET/POST /api/admin/products`, `POST /api/admin/sections`, `POST/DELETE /api/admin/sections/:id/products`.
- UI admin: gestione flag nutrizionali, toggle stato sezione, `enableDateTime` limitato a `pranzo`/`cena`, assegnazioni prodotto con featured/home.
- Documentazione aggiornata (README, audit catalogo) e pulizia snapshot legacy.

## v0.1.x – Prenotazioni legacy
- Landing marketing, wizard prenotazione multipassaggio, email e pannello admin storico.
