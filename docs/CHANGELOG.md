---
merged_from:
  - docs/CHANGELOG.md
  - CHANGELOG.md
updated: 2025-02-14
---
# Changelog

## [Unreleased]
### Added
- Nuova documentazione `docs/AUTH.md`, `docs/BUILD_AND_DEPLOY.md`, `docs/SECURITY.md`, `OPERATIONS.md` con runbook, threat model e pipeline Vercel.
- Template `.env.example` in `docs/.env.example` e sezione dedicata in `docs/ENVIRONMENT.md` (matrice ambienti, requisiti runtime).
- Diagramma ER aggiornato e guida migrazioni/seed in `docs/DATABASE.md`.

### Changed
- README completamente riscritto con overview stack, setup passo-passo, flussi chiave, troubleshooting e risk log.
- `docs/ROUTES.md` riorganizzato (pagine pubbliche, area admin, API, convenzioni).
- `docs/TEST_PLAN.md` aggiornato con test manuali minimi, edge case e idee Playwright/Vitest.

### Fixed
- Allineata la documentazione alle configurazioni correnti (NextAuth v5, middleware admin, seed PostgreSQL) e chiariti i requisiti `NEXTAUTH_URL`/`AUTH_URL` per produzione.

## 2025-10-10
### Added
- Documentazione aggiornata: snapshot stato repo, architettura, flussi checkout/email e guida sviluppo.
- Nuovo report di audit documentale con decisioni e TODO mirati.

### Changed
- README riscritto con setup rapido e collegamenti alla documentazione.

### Removed
- Contenuti obsoleti del README precedente (roadmap legacy, tracker MVP).

## v0.2.0 – Catalogo fase 1 (ottobre 2025)
- Schema Prisma esteso con `Product`, `CatalogSection`, `SectionProduct`, `EventInstance`, `Cart`, `CartItem`, `Order`.
- Nuove pagine admin: `/admin/catalog/products` e `/admin/catalog/sections` con ToastProvider condiviso.
- Endpoint pubblico `GET /api/catalog` e suite admin `GET/POST /api/admin/products`, `POST /api/admin/sections`, `POST/DELETE /api/admin/sections/:id/products`.
- UI admin: gestione flag nutrizionali, toggle stato sezione, `enableDateTime` limitato a `pranzo`/`cena`, assegnazioni prodotto con featured/home.
- Documentazione aggiornata (README, audit catalogo) e pulizia snapshot legacy.

## v0.1.x – Prenotazioni legacy
- Landing marketing, wizard prenotazione multipassaggio, email e pannello admin storico.

## Cronologia merge
- Contenuti originali: `docs/CHANGELOG.md`, `CHANGELOG.md` (ottobre 2025).
