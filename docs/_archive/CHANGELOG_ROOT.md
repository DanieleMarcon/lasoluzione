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
