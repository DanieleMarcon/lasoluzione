Aggiornato al: 2025-02-15

## Mini-TOC
- [Cos'è il progetto](#cosè-il-progetto)
- [Come orientarsi nella documentazione](#come-orientarsi-nella-documentazione)
- [Link rapidi indispensabili](#link-rapidi-indispensabili)
- [Percorsi di lettura suggeriti](#percorsi-di-lettura-suggeriti)
- [Documentazione storica](#documentazione-storica)
- [Riferimenti incrociati](#riferimenti-incrociati)

# Documentazione La Soluzione

Questa raccolta descrive **La Soluzione**, piattaforma Next.js 14 con App Router, integrazione Prisma/SQLite e flussi di prenotazione-eventi con checkout Revolut. È la landing umana: da qui raggiungi panoramiche, reference operative e archivio storico senza consultare la struttura Git.

## Cos'è il progetto
- **Dominio**: gestione eventi, prenotazioni ristorante e vendita esperienze tramite catalogo e pagamenti online.
- **Stack**: Next.js (App Router), React server/client components, Prisma ORM su SQLite, Auth.js con magic link, Vercel per deploy, Supabase come storage secondario (log e RLS TBD).
- **Missione**: fornire al team operativo un'unica base di conoscenza per sviluppo, QA e presidio post-go-live.

## Come orientarsi nella documentazione
| Ruolo | Strumento | Uso consigliato |
| --- | --- | --- |
| ChatGPT (planner) | Consultare `PROJECT_OVERVIEW.md`, `WORKFLOW_AND_ENVIRONMENT_GUIDE.md`, `ROADMAP.md` prima di orchestrare task multipli. |
| Codex / agente esecutivo | Partire da `INDEX.md` per localizzare i file tecnici, poi seguire `BACKEND.md`, `FRONTEND.md`, `PAYMENTS.md` per contesto implementativo e API. |
| Dev umano | Usare `README.md` → `PROJECT_OVERVIEW.md` per il quadro generale, poi i manuali specifici (`DEPLOYMENT.md`, `KNOWN_ISSUES.md`, `TESTING.md`) per operazioni quotidiane. |

## Link rapidi indispensabili
- [PROJECT_OVERVIEW.md](./PROJECT_OVERVIEW.md) — contesto, obiettivi e componenti principali.
- [INDEX.md](./INDEX.md) — indice tecnico sistematico aggiornato.
- [WORKFLOW_AND_ENVIRONMENT_GUIDE.md](./WORKFLOW_AND_ENVIRONMENT_GUIDE.md) — processi operativi e setup strumenti.
- [ARCHITECTURE.md](./ARCHITECTURE.md) — viste logiche/fisiche e schema Prisma completo.
- [BACKEND.md](./BACKEND.md) — API reference, middleware, database e catalogo errori.
- [FRONTEND.md](./FRONTEND.md) — UI admin dettagliata, filtri, layout e note UX.
- [PAYMENTS.md](./PAYMENTS.md) — flusso Revolut, webhook, idempotenza e variabili ambiente.
- [DEPLOYMENT.md](./DEPLOYMENT.md) — pipeline Vercel, motore Node e checklist post-release.
- [KNOWN_ISSUES.md](./KNOWN_ISSUES.md) — bug riproducibili, log richiesti e priorità.
- [ROADMAP.md](./ROADMAP.md) — fasi evolutive con criteri di done e ownership.
- [TESTING.md](./TESTING.md) — batterie manuali, casi limite e automazione futura.

## Percorsi di lettura suggeriti
1. **Onboarding rapido**: `PROJECT_OVERVIEW.md` → `ARCHITECTURE.md` → `BACKEND.md`.
2. **Focus pagamenti**: `PAYMENTS.md` → `BACKEND.md` (sezione Revolut API) → `KNOWN_ISSUES.md` (errori 500/timeout) → `ROADMAP.md` (milestone payout).
3. **Operazioni quotidiane**: `WORKFLOW_AND_ENVIRONMENT_GUIDE.md` → `DEPLOYMENT.md` → `TESTING.md` → `CHANGELOG.md`.
4. **Refactoring admin**: `FRONTEND.md` → `KNOWN_ISSUES.md` (React minificati) → `ROADMAP.md` (iniziative UI/UX).

## Documentazione storica
- [docs/_archive/README.md](./_archive/README.md) — guida ai documenti precedenti con motivazioni di archiviazione.
- Archivio tematico (`_archive/*.md`) disponibile per confronti storici: citato all’interno delle sezioni aggiornate tramite blocchi “Provenienza & Storia”.

## Riferimenti incrociati
- `INDEX.md` elenca tutte le fonti con timestamp e mapping archivio ↔ attivo.
- `CHANGELOG.md` traccia quando ogni documento ha ricevuto hardening / integrazione.
- `PROJECT_OVERVIEW.md` collega i principali owner e i repository ancillari.
