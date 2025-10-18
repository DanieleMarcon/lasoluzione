---
merged_from:
  - docs/CHANGELOG.md
  - CHANGELOG.md
updated: 2025-02-14
---
# Changelog

## [Unreleased]

## 2025-02-15 – Docs hardening & deepening
### Added
- Nuovi documenti `DEPLOYMENT.md`, `KNOWN_ISSUES.md`, `ROADMAP.md` con checklist, priorità bug e milestone evolutive.
- Sequenza Revolut + matrice stati prenotazione in `PAYMENTS.md`, inclusa specifica webhook proposta.
- Mini-TOC e sezione "Mappa consolidamento" in `INDEX.md` per navigazione rapida tra attivo/archivio.

### Changed
- `BACKEND.md` ampliato con tabelle API dettagliate, matrice CORS, schema Prisma completo e catalogo errori.
- `FRONTEND.md` arricchito con tabella prenotazioni admin, filtri, suggerimenti refactor e elenco errori React collegati a `KNOWN_ISSUES.md`.
- `WORKFLOW_AND_ENVIRONMENT_GUIDE.md` ristrutturato con diagrammi mermaid, procedure passo-passo e checklist anti-errore.
- `README.md` riposizionato come landing entry point (link rapidi e percorsi di lettura).

### Fixed
- Documentazione allineata a runtime Node 20.x su Vercel e mapping branch docs → main per evitare deploy accidentali.

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
