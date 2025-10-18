
# La Soluzione — Guida Operativa Completa (Ambiente, Flussi, Branching, Deploy)

> **Scopo**: questa guida rende autonomo chiunque (anche senza esperienza) nel lavorare sul repository **lasoluzione**, coordinando ChatGPT, Codex, GitHub, VS Code, GitHub Desktop, Vercel, Supabase e SiteGround. Contiene flussi _end‑to‑end_, procedure passo‑passo, checklist anti‑errore e strategie di branching/deploy.

---

## 0) Glossario rapido

- **ChatGPT**: pensa e scrive prompt, definisce la strategia, prepara la documentazione.
- **Codex**: esegue i prompt tecnici, modifica il codice, apre **Pull Request (PR)** sul repository GitHub.
- **GitHub**: repository remoto; ospita branch, PR e integrazioni (Vercel/Supabase).
- **GitHub Desktop**: client grafico per sincronizzare branch tra GitHub ↔ locale.
- **VS Code**: editor locale usato per verifiche, fix veloci, commit “manuali”.
- **Vercel**: piattaforma di deploy. Crea **Preview** per ogni PR/branch e **Production** quando si aggiorna il branch di produzione (di norma `main`).
- **Supabase**: database e autenticazione; si integra con GitHub e Vercel (env, migrazioni).
- **SiteGround**: DNS/hosting del dominio, punta a Vercel (record DNS).

---

## 1) Architettura di alto livello e flussi

### 1.1 Flusso standard “da idea a produzione”
1. **Pianificazione con ChatGPT** → definisce obiettivi, scrive prompt operativi per Codex.
2. **Esposizione a Codex** → Codex lavora su **un branch dedicato**, spinge le modifiche su GitHub e apre una **PR**.
3. **Vercel** crea automaticamente un **Preview Deploy** per la PR/branch.
4. **Verifica su Preview** (QA, test manuali, eventuali fix) → si aggiorna lo stesso branch finché è “verde”.
5. **Merge** → si unisce la PR in **main** (o nel branch di destinazione) tramite GitHub.
6. **Vercel Production Deploy** → parte al merge (se “Production Branch” = `main`).

### 1.2 Flusso alternativo “documentazione separata”
- Tutta la documentazione vive in un branch **`docs/*`** (es. `docs/audit-2025-10`) per permettere review spedite, senza toccare `main`.
- Quando pronta, si **merge** in `main` (o si mantiene separata se è un “playbook” interno).

---

## 2) Strategia di branching consigliata

- **main** → branch di produzione (protetto). Solo PR approvate entrano qui.
- **feat/** → nuove funzionalità (es. `feat/admin-bookings-totale-dettaglio`).
- **fix/** → correzioni specifiche (es. `fix/contacts-500-api`).
- **docs/** → sola documentazione (es. `docs/workflow-and-env`).
- **hotfix/** → patch urgenti da promuovere subito in produzione.

**Regole d’oro**
- Mai sviluppare direttamente su `main`.
- PR piccole, atomiche e tematiche.
- Ogni PR deve avere **descrizione chiara**, **lista file** e **link al Preview Vercel**.
- Abilitare protezioni su `main` (branch protection): nessun push diretto, 1+ review obbligatorie, CI/Preview verdi.

---

## 3) Come creare e usare un branch “documentazione” (o qualunque altro)

### 3.1 Creazione del branch da GitHub (consigliato)
1. Vai su **GitHub → Repo → Branch menu → New branch**.
2. Nome suggerito: `docs/workflow-and-env`.
3. Crea **pull request** vuota opzionale per collegare subito Vercel Preview.

### 3.2 Collegare Codex al branch
- In Codex, seleziona il branch **`docs/workflow-and-env`** dal selettore dei rami.
- Tutti i commit/PR generati da Codex andranno su questo branch (o come PR verso questo branch, a seconda del flusso).

### 3.3 Lavorare in locale sul branch
**GitHub Desktop**
1. `Current repository` → seleziona repo.
2. `Current branch` → **Fetch origin** → **Switch branch** → scegli `docs/workflow-and-env`.
3. `Pull` per scaricare aggiornamenti.
4. Apri in **VS Code** con il pulsante “Open in Visual Studio Code”.

**VS Code**
- Esegui modifiche, salva, poi **Git** sidebar → **Stage Changes** → **Commit** → **Push**.
- Torna su GitHub per verificare la PR e/o su Vercel per il Preview.

---

## 4) Pull Request: casi pratici importanti

### 4.1 PR “branch → main” (flusso standard)
- **Scopo**: portare il tuo lavoro in produzione.
- **Passi**:
  1. Completi il lavoro su `feat/...` o `docs/...`.
  2. Apri PR **verso `main`**.
  3. Controlla i **check**: Preview Vercel deve essere ok.
  4. **Merge** (Squash & merge consigliato per storia pulita).
  5. Vercel avvia **Production Deploy** su `main` automaticamente.

### 4.2 PR “Codex → branch non‑main” (es. aggiornare _documentazione_ senza toccare main)
- **Scopo**: aggiornare **solo** `docs/...`.
- **Passi**:
  1. In Codex seleziona **il branch** `docs/...` come **target** (non `main`).
  2. Codex aprirà una PR **verso `docs/...`** (o push diretto sul branch, a seconda dello strumento).
  3. Vercel creerà un **Preview** per `docs/...` (se configurato per pre‑deploy di branch).  
  4. **Merge PR → docs/...**: nessun deploy di produzione partirà (perché la **Production Branch** resta `main`).

### 4.3 Promuovere **documentazione** da `docs/...` → `main`
- Quando vuoi che la doc aggiornata appaia in `main`:
  1. Apri PR **da `docs/...` verso `main`**.
  2. Review + Merge.
  3. Vercel farà un deploy di produzione **solo se** il contenuto della doc influenza l’app (es. pagine statiche). In caso di repo “app only”, spesso la doc non tocca bundle/rotte e il deploy è veloce.

---

## 5) Vercel: come funziona (Preview vs Production) e come “forzare” i deploy

### 5.1 Impostazioni chiave
- **Production Branch**: normalmente `main`. Qualunque merge/push su `main` → **Production Deploy**.
- **Preview Deploys**: Vercel genera un URL per ogni PR e per ogni branch non‑main.

### 5.2 Forzare un deploy
- **Re‑deploy di un build esistente**: in Vercel → seleziona il deployment → **Redeploy**.
- **Deploy di un commit/branch specifico**: in Vercel → **New Deployment** → scegli branch/commit.
- **Ignorare build**: opzionale via commit message (`[skip ci]`) se usi automazioni esterne.

### 5.3 Passare da “documentazione” a “produzione”
- Non serve “spostare” deploy: è il **merge su `main`** a generare il deploy di produzione.
- Se necessario testare “come se fosse produzione” si può:
  - Impostare temporaneamente **Production Branch** a `docs/...` (sconsigliato, rischi)
  - Oppure usare environment separati (Project duplicato o Environment “Preview”/“Development” con env var diverse).

---

## 6) Supabase: integrazione e buone pratiche

- **Env var**: gestite in Vercel (Project → Settings → Environment Variables) per collegare l’app all’istanza Supabase.
- **Migrazioni DB**:
  - Versionare script/migrations (folder `supabase/migrations` o prisma migrations se usi Prisma).
  - PR: includi migrazioni + istruzioni. In produzione, migrazioni partono in fase di build/run se previsto.
- **Dati di test**: usa **branch DB** o tabelle seed per Preview (evita di toccare i dati di produzione).

---

## 7) Lavorare in locale senza fare danni (anti‑errore)

### 7.1 Checklist quotidiana
1. **GitHub Desktop → Fetch** sempre prima di iniziare.
2. Verifica il **branch corrente** (barra in alto): SEI davvero su `feat/...` o `docs/...`?
3. **Pull** prima di modificare (eviti divergenze).
4. Commit piccoli, messaggi chiari (`feat: …`, `fix: …`, `docs: …`).
5. **Push** e verifica su GitHub (PR aggiornata) e su Vercel (Preview).

### 7.2 Evitare commit sul branch sbagliato
- Attiva **branch protection** su `main` (no push diretto).
- Usa **GitLens** in VS Code per visibilità dei branch.
- Regola personale: se il lavoro cambia tema, **nuovo branch**.

### 7.3 Aggiornare il tuo branch con `main`
- Quando `main` avanza, porta dentro le novità:
  - **GitHub Desktop**: `Branch` → `Update from main` (merge)  
  - Oppure terminale: `git fetch origin && git checkout tuo-branch && git merge origin/main`
- Risolvi conflitti, testa su Preview, continua.

---

## 8) Come “unire” il lavoro di Codex e locale senza confusione

### Scenario A — Codex spinge su **stesso branch** che usi in locale
1. Tu fai **Pull** su `docs/...` in GitHub Desktop.
2. Vedi i commit di Codex; continui dal loro stato.
3. Eventuali conflitti? Risolvili in VS Code → commit → push.

### Scenario B — Codex apre **PR verso un branch** (non `main`)
1. Lavora in locale sullo **stesso branch** target della PR.
2. Spingi ulteriori commit → la PR si aggiorna automaticamente.
3. Quando tutto è ok → **Merge** PR (verso quel branch o verso `main` a seconda del flusso).

### Scenario C — Vuoi **prendere solo alcune cose** da un branch
- Apri PR **selettiva** o usa `git cherry-pick <commit>` in locale (avanzato).
- In alternativa: **Squash & merge** per portare solo il risultato finale in `main`.

---

## 9) Processo pratico chiave: “Aggiornare documentazione senza toccare main”

1. **Crea branch** `docs/workflow-and-env` su GitHub.
2. **Collega Codex** al branch (selettore rami in Codex).
3. **Codex**: produce contenuti e **apre PR verso `docs/workflow-and-env`** (o push diretto).
4. **Vercel**: genera **Preview** per `docs/workflow-and-env` (se il progetto è web-docs).
5. **Review** → **Merge** PR **verso `docs/workflow-and-env`** (non `main`).  
6. **Promozione** (quando serve): PR **da `docs/workflow-and-env` a `main`** → merge → **Production Deploy**.

> Nota: se la documentazione vive solo nella cartella `/doc` e non influenza l’app, il deploy sarà quasi istantaneo e “a basso rischio”.

---

## 10) Processo pratico chiave: “Forzare tests Preview completi prima di toccare main”

1. Sviluppo in `feat/...`.
2. PR **feat → staging** (crea un branch `staging` opzionale).  
3. Test su **Preview di `staging`** (ha env di staging).
4. Quando tutto ok → PR **staging → main** → deploy produzione.

---

## 11) Esempi di comandi utili (CLI opzionale)

```bash
# Clona il repo (prima volta)
git clone git@github.com:DanieleMarcon/lasoluzione.git
cd lasoluzione

# Vedi branch remoti
git branch -r

# Crea e passa a un nuovo branch di lavoro
git checkout -b docs/workflow-and-env origin/main

# Porta nel tuo branch gli aggiornamenti da main
git fetch origin
git merge origin/main

# Aggiungi, committa e spingi
git add .
git commit -m "docs: aggiorna guida ambiente e workflow"
git push -u origin docs/workflow-and-env
```

> In alternativa, usa sempre **GitHub Desktop** se preferisci l’interfaccia grafica.

---

## 12) Checklist PR prima del merge

- [ ] Descrizione chiara (cosa, perché, come testare).
- [ ] Screenshot o link al **Preview Vercel**.
- [ ] Lint/Typecheck ok (Next.js build ok, Prisma generate ok).
- [ ] Database migrazioni verificate (se presenti).
- [ ] Non ci sono credenziali nel codice (usa env).

---

## 13) Troubleshooting (FAQ)

**D: La Preview Vercel non si aggiorna.**  
R: Assicurati di aver fatto **push** sul branch corretto. In Vercel puoi usare **Redeploy** o **New Deployment** puntando al branch.

**D: Ho fatto commit sul branch sbagliato.**  
R: Crea un branch dal commit attuale (`git checkout -b fix/giusto`), poi ripristina l’altro branch allo stato precedente da GitHub (revert) o con `git reset` (avanzato).

**D: PR vuole mergiare su `main` ma io volevo aggiornare `docs/...`.**  
R: Nella pagina PR, cambia il **base branch** (in alto: `base: docs/... compare: tuo-branch`).

**D: “Il deploy di produzione non è cambiato”.**  
R: Production si attiva **solo** al push/merge su **Production Branch** (spesso `main`). Assicurati che il merge sia effettivamente entrato in `main` e non in `docs/...`.

**D: Come verifico “da dove” ha deployato Vercel?**  
R: Nella pagina del Deployment Vercel c’è sempre il riferimento a **repo/branch/commit**. Deve corrispondere al branch atteso.

---

## 14) Policy minime consigliate

- **Branch protection** su `main` (no push diretto, 1 review richiesta).
- **CI pre‑merge**: Next build + typecheck (per evitare rotture in produzione).
- **Env var per ambiente**: Development/Preview/Production in Vercel con valori diversi.
- **Accessi**: permessi minimi per scrittura sui branch protetti.

---

## 15) Modello di “Definition of Done” (DoD)

- Funziona su Preview Vercel (link incluso in PR).
- Nessun errore in console significativi (client e server).
- Documentazione aggiornata (se serve) in `/doc`.
- Migrazioni DB applicate e testate (se presenti).
- PR piccola, comprensibile, con checklist spuntata.

---

## 16) Riepilogo operativo per il tuo caso d’uso (documentazione)

1. **Crea branch** `docs/workflow-and-env` su GitHub.
2. **Seleziona il branch in Codex** e chiedi l’aggiornamento/creazione dei file Markdown in `/doc`.
3. **Review** su GitHub (PR → Preview se serve).
4. **Merge in `docs/...`** (niente produzione ancora).
5. Quando pronta, **PR da `docs/...` a `main`** → merge → (eventuale) **Production Deploy**.
6. **GitHub Desktop**: tieni sempre sincronizzati i branch sul tuo locale per eventuali fix veloci in VS Code.

---

> **Suggerimento**: Mantieni questo file tra i “pin” del repo (`/doc/WORKFLOW_AND_ENVIRONMENT_GUIDE.md`) e aggiornalo ogni volta che cambia una policy o un flusso.
