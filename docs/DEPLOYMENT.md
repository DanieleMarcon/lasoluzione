Aggiornato al: 2025-02-15

## Mini-TOC
- [Deployment — Vercel](#deployment--vercel)
  - [Panoramica pipeline](#panoramica-pipeline)
  - [Branch & ambienti](#branch--ambienti)
  - [Motore Node & runtime](#motore-node--runtime)
  - [Deploy hooks & automazioni](#deploy-hooks--automazioni)
  - [Redeploy, rollback, ripartenze](#redeploy-rollback-ripartenze)
  - [Verifiche post-deploy](#verifiche-post-deploy)
  - [Checklist operativa](#checklist-operativa)
- [Riferimenti incrociati](#riferimenti-incrociati)
- [Provenienza & Storia](#provenienza--storia)

# Deployment — Vercel

## Panoramica pipeline
| Evento | Azione Vercel | Output |
| --- | --- | --- |
| Push/PR su qualunque branch ≠ production | Preview Build | URL `https://lasoluzione-git-<branch>.vercel.app` + log build. |
| Merge/push su `main` | Production Deploy | Aggiorna `https://lasoluzione.it` (via alias). |
| Manual Redeploy | Ricompila commit specifico | Utile per ricreare build fallite o aggiornare env. |

## Branch & ambienti
- **Production Branch**: `main` (Settings → Git → Production Branch).
- **Preview Branches**: tutte le PR e branch custom (`docs/*`, `feat/*`, `fix/*`).
- **Environment variables**:
  - `Production`: credenziali reali (SMTP live, Revolut prod, Supabase prod).
  - `Preview`: credenziali sandbox (SMTP test, Revolut sandbox, DB staging).
  - `Development`: valori per `vercel dev` / `next dev`.
- Per branch documentazione (`docs/*`) Vercel crea preview anche se l'app non cambia: usare per QA statico.

## Motore Node & runtime
- `package.json` definisce `"engines": { "node": ">=20 <21" }`. Vercel, al momento, può indicare Node 22.x nella dashboard ma **rispetta l'engine** del progetto, quindi runtime effettivo: **Node.js 20.x**.
- Configurazione API:
  - Rotte payments e bookings impostano `export const runtime = 'nodejs'` per abilitare Nodemailer/Revolut SDK.
  - Nessuna rotta Edge attiva. Evitare di forzare `edge` su API che usano Prisma.
- Se necessario usare Node 22.x, aggiornare `package.json` **e** Vercel Project Settings (doppia conferma).

## Deploy hooks & automazioni
| Hook | URL | Scopo |
| --- | --- | --- |
| (Da creare) `docs-preview` | `https://api.vercel.com/v1/integrations/deploy/prj_xxx/docs` | Triggerare build documentazione su schedule (cron). |
| `production` (default) | Autogenerato da Vercel | Permette a Supabase o altri sistemi di forzare deploy main. |

> Attualmente non esistono deploy hook personalizzati nel repository. Tenere traccia in `ROADMAP.md` quando verranno configurati.

## Redeploy, rollback, ripartenze
1. **Redeploy**: Vercel → Deployment → `Redeploy` (scegli “Redeploy using same Git commit”).
2. **Deploy manuale**: `New Deployment` → seleziona branch/commit → facoltativo `env` override.
3. **Rollback**: apri deployment precedente → `Promote to Production`.
4. **Stop deploy**: durante build clic `Cancel deployment` (utile se config errata).

## Verifiche post-deploy
| Step | Comando/URL | Cosa controllare |
| --- | --- | --- |
| Healthcheck | `https://lasoluzione.it/api/ping` | Risposta `{"ok":true}` e `ts` aggiornato. |
| Admin login | `/admin/signin` + email whitelist | Ricezione magic link, accesso area riservata. |
| Booking pubblico | `/prenota` | Form, carrello (se `NEXT_PUBLIC_CART_ENABLED`). |
| Checkout Revolut | `/checkout/return` (preview) | Stato `pending`/`paid` coerente; log `provider_error`. |
| Log Vercel | UI Logs | Errori 500, warning Prisma, mailer. |
| Errori noti | `docs/KNOWN_ISSUES.md` | Aggiornare stato issue se risolte (es. `/api/admin/contacts` 500). |

## Checklist operativa
- [ ] Conferma commit deployato (`git rev-parse HEAD`) = commit Vercel.
- [ ] Verifica preview e produzione puntano allo stesso commit (Production tab → Git SHA).
- [ ] Controlla `CHANGELOG.md` aggiornato con voce release.
- [ ] Aggiorna `ROADMAP.md` se milestone completata.
- [ ] Documenta eventuali incident in `DEVOPS.md` (post-mortem).

## Riferimenti incrociati
- `DEVOPS.md` — runbook incident e gestione emergenze.
- `PAYMENTS.md` — sequenza checkout e note sandbox/production.
- `WORKFLOW_AND_ENVIRONMENT_GUIDE.md` — definisce quando aprire PR e rilasciare.

## Provenienza & Storia
SORGENTE: Nuovo documento (requisito hardening 2025-02-15)
COMMIT: 9d9f5c3
MOTIVO DELLO SPOSTAMENTO: esplicitare pipeline Vercel, nota engines Node e checklist post-deploy.
DIFFERENZE CHIAVE: n/d (documento nuovo).
