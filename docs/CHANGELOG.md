---
merged_from:
  - docs/CHANGELOG.md
  - CHANGELOG.md
updated: 2025-02-14
---
# Changelog

## [Unreleased]

### Fixed
- fix: `/api/admin/contacts` non passa più `NULL` a `_limit`/`_offset`, normalizza i filtri `newsletter`/`privacy` a `yes|no|all` e riallinea il mapping `ContactDTO` (date ISO, contatori fallback).【F:src/lib/admin/contacts-service.ts†L15-L78】【F:src/app/api/admin/contacts/route.ts†L1-L63】【F:src/app/api/admin/contacts/export/route.ts†L1-L110】
- fix: hardened `/api/admin/contacts` via Supabase function with bound Prisma parameters, admin UI fallback banner, and Node engines aligned to 22.x for Vercel builds.【F:package.json†L1-L11】【F:src/lib/admin/contacts-service.ts†L1-L78】【F:src/app/api/admin/contacts/route.ts†L1-L63】【F:src/components/admin/contacts/ContactsPageClient.tsx†L1-L316】
- fix: admin contacts API mapping & total count — snake_case→camelCase, compatibilità con Supabase `admin_contacts_search` e view `admin_contacts_view`.【F:src/app/api/admin/contacts/route.ts†L10-L87】【F:docs/BACKEND.md†L329-L360】
- fix: admin contacts client normalizza payload `{ items|data }`, converte snake_case in camelCase e gestisce array mancanti per evitare fallback "Dati temporaneamente non disponibili".【F:src/components/admin/contacts/ContactsPageClient.tsx†L1-L212】
- fix: Contacts: prefer lastContactAt, safe fetch to avoid SSR 500.【F:src/components/admin/contacts/ContactsPageClient.tsx†L1-L233】

### Changed
- change: navigazione Admin ripulita — heading unico in layout, `AdminNav` restituisce solo `<nav>` e il link "Contatti" vive esclusivamente nella sezione CRM.【F:src/app/admin/(protected)/layout.tsx†L1-L39】【F:src/components/admin/AdminNav.tsx†L1-L138】【F:docs/FRONTEND.md†L125-L152】
- feat: `/api/admin/contacts` usa `admin_contacts_search_with_total` in singola chiamata, logging strutturato in preview/dev ed export CSV riallineato ai nuovi normalizzatori.【F:src/lib/admin/contacts-service.ts†L1-L124】【F:src/app/api/admin/contacts/route.ts†L1-L77】【F:src/app/api/admin/contacts/export/route.ts†L1-L118】

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
- Allineata la documentazione alle configurazioni correnti (NextAuth v5, middleware admin, seed PostgreSQL) e chiariti i requisiti `NEXTAUTH_URL`/`AUTH_URL` per produzione.
- Fix: admin contacts API 500 (paginazione `page/pageSize`, risposta `{ items, total }`, gestione `401` per utenti non admin).
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
