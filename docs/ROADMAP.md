Aggiornato al: 2025-02-15

## Mini-TOC
- [Roadmap — La Soluzione](#roadmap--la-soluzione)
  - [Fase 1: Hardening documentazione & QA](#fase-1-hardening-documentazione--qa)
  - [Fase 2: Pagamenti live Revolut](#fase-2-pagamenti-live-revolut)
  - [Fase 3: Admin UX & reliability](#fase-3-admin-ux--reliability)
  - [Fase 4: Observability & analytics](#fase-4-observability--analytics)
- [Riferimenti incrociati](#riferimenti-incrociati)
- [Provenienza & Storia](#provenienza--storia)

# Roadmap — La Soluzione

## Fase 1: Hardening documentazione & QA
- **Criteri di Done**
  - Checklist PR documentazione completata (vedi `CHANGELOG.md`).
  - Tutti i file docs con `Aggiornato al` + mini-TOC.
  - Known issues prioritizzati con log richiesti.
- **Dipendenze**: nessuna tecnica; richiede collaborazione team doc.
- **Owner**: Squad Docs (ChatGPT + Codex + reviewer umano).
- **Impatto deploy**: nessun deploy produzione previsto (branch `docs/*`).

## Fase 2: Pagamenti live Revolut
- **Criteri di Done**
  - Variabili produzione configurate (`REVOLUT_SECRET_KEY`, domini allowed).
  - Webhook `order.completed` attivo (`/api/payments/revolut-webhook`).
  - Payout test completato in sandbox + smoke test produzione.
  - Documentazione aggiornata (`PAYMENTS.md`, `KNOWN_ISSUES.md` rimozione PAY-Timeout-Poll se risolto).
- **Dipendenze**: Fase 1 completata (doc chiara); Supabase per storage webhook event.
- **Owner**: Squad Checkout (dev backend + devops).
- **Impatto deploy**: Production deploy `main` con credenziali nuove, monitoraggio Vercel + Revolut dashboard.

## Fase 3: Admin UX & reliability
- **Criteri di Done**
  - Refactor tabella prenotazioni (icon buttons, tooltip unificati, responsive <1024px).
  - Fix FE-React-423 / FE-React-425 con fallback UI.
  - API `/api/admin/contacts` migrata (o disabilitata) + test QA.
  - Documentazione `FRONTEND.md` aggiornata con screenshot aggiornati.
- **Dipendenze**: Pagamenti live (per evitare conflitti release). Migrazioni DB per tabella contacts se introdotta.
- **Owner**: Squad Admin (frontend lead + backend support).
- **Impatto deploy**: Production deploy coordinato, richiede smoke test area admin + aggiornamento QA checklist in `TESTING.md`.

## Fase 4: Observability & analytics
- **Criteri di Done**
  - Integrazione logger con sink esterna (Datadog/Logtail) e tracciamento requestId.
  - Metriche chiave: tasso conversione checkout, errori 4xx/5xx, prestazioni `/api/payments/order-status`.
  - Dashboard Supabase/Metabase per prenotazioni e ordini.
  - Roadmap aggiornata per fasi successive (es. fidelity program).
- **Dipendenze**: Fase 2 completata (pagamenti stabili), accesso account logging.
- **Owner**: Squad Platform.
- **Impatto deploy**: Config env extra (API keys logging), aggiornamento `DEVOPS.md` con runbook.

## Riferimenti incrociati
- `PAYMENTS.md` — milestone Fase 2.
- `FRONTEND.md` — cambi UX da Fase 3.
- `KNOWN_ISSUES.md` — backlog priorizzato.
- `DEVOPS.md` — runbook da aggiornare post osservabilità.

## Provenienza & Storia
SORGENTE: Nuovo documento roadmap 2025-02-15  
COMMIT: 9d9f5c3  
MOTIVO DELLO SPOSTAMENTO: definire milestone con criteri di done, dipendenze e impatto deploy.  
DIFFERENZE CHIAVE: n/d (creazione iniziale).
