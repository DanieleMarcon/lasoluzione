
# Guida Operativa — Ambiente di Lavoro, Flussi e Processi

## 1. Panoramica Generale

Questo documento descrive in dettaglio l’ambiente di sviluppo, gli strumenti coinvolti e i flussi di lavoro tra ChatGPT, Codex, GitHub, VS Code, Supabase, Vercel e SiteGround.

L’obiettivo è garantire una comprensione completa del ciclo di vita del progetto — dallo sviluppo locale al deploy in produzione — e stabilire procedure sicure e ripetibili per collaborare con Codex e mantenere aggiornati i branch.

---

## 2. Componenti dell’Ambiente di Lavoro

### 🔹 ChatGPT
- Analizza, progetta, pianifica e genera prompt per Codex.  
- Non interagisce direttamente con i repository o ambienti esterni.  
- Può produrre audit, roadmap e specifiche tecniche.

### 🔹 Codex
- Strumento collegato a **GitHub** per scrivere codice, aggiornare documentazione, creare **branch** e aprire **PR (pull request)**.  
- Tutte le modifiche passano attraverso PR, che vanno approvate manualmente prima del merge.  
- Non può interagire direttamente con Vercel, Supabase o SiteGround, ma può aggiornare file che ne influenzano i comportamenti (es. `vercel.json`, `.env`, `schema.prisma`).

### 🔹 VS Code
- Editor di sviluppo locale collegato a GitHub tramite Git.  
- Permette di modificare, testare e validare localmente il codice.  
- Sincronizza i branch tramite **GitHub Desktop** o CLI (`git fetch/pull/push`).

### 🔹 GitHub Desktop
- Interfaccia grafica per gestire branch e commit senza CLI.  
- Permette di scaricare (pull) aggiornamenti, creare branch, unire PR e caricare (push) modifiche verso GitHub.

### 🔹 GitHub
- Repository remoto principale.  
- Contiene tutti i branch, le PR, le versioni e le azioni di CI/CD integrate.  
- Interagisce con **Vercel** (per il deploy) e **Supabase** (per il database).

### 🔹 Supabase
- Gestisce i database e le API serverless collegate.  
- Sincronizzato con GitHub e Vercel per aggiornare schema e dati in base alle release.  
- Espone URL e chiavi gestite tramite variabili ambiente (`.env.local`, `VERCEL_ENV`, ecc.).

### 🔹 Vercel
- Gestisce il **build** e il **deploy** automatico dei branch di GitHub.  
- Ogni branch genera una **preview** (`nomebranch.vercel.app`), e il **main** viene pubblicato su dominio principale.  
- Interagisce con GitHub per deploy automatici e con SiteGround per DNS/hosting.

### 🔹 SiteGround
- Gestisce il dominio e i DNS.  
- Punta ai record Vercel per pubblicare online.  
- Non ospita il codice, ma serve solo come ponte DNS tra dominio e Vercel.

---

## 3. Flussi di Informazione e Processo

### 🔸 Flusso Generale (Sviluppo → Produzione)
```
ChatGPT → Codex → GitHub (branch) → PR → Merge → Vercel (build/deploy) → SiteGround (DNS)
```
1. **ChatGPT** crea i prompt tecnici o strategici.  
2. **Codex** li esegue, crea un nuovo branch e apre una PR.  
3. **GitHub** riceve la PR → il team la verifica e approva.  
4. **Merge su `main`** = trigger automatico build su **Vercel**.  
5. **Vercel** esegue il deploy → **SiteGround** mostra il nuovo sito.

### 🔸 Flusso di Lavoro Locale (VS Code + GitHub Desktop)
1. Seleziona o crea il branch (`feature/...`, `docs/...`).  
2. Modifica il codice in VS Code.  
3. Esegui test locali (`pnpm dev`, `pnpm test`).  
4. Commit → Push su GitHub → Verifica deploy in Vercel Preview.  
5. Se tutto è corretto → Merge nel branch principale (di solito `main`).

### 🔸 Branching Strategy
- `main`: codice stabile in produzione.  
- `develop` (opzionale): staging o pre-produzione.  
- `feat/...`: nuove feature o miglioramenti.  
- `fix/...`: bugfix mirati.  
- `docs/...`: aggiornamenti di documentazione.  
- `hotfix/...`: interventi urgenti in produzione.

### 🔸 PR e Merge
- Codex crea automaticamente una **PR** quando propone modifiche.  
- La PR deve essere revisionata su GitHub.  
- Una volta approvata → Merge nel branch desiderato (`main` o `feature/...`).  
- Il merge su `main` avvia **deploy automatico** in Vercel.

### 🔸 Sincronizzazione Locale
- Usa **GitHub Desktop** per allineare i branch:  
  - `Fetch origin` → scarica aggiornamenti.  
  - `Pull` → sincronizza branch locale.  
  - `Push` → invia modifiche locali a GitHub.  
- Evita di committare direttamente su `main`. Lavora su branch separati.

---

## 4. Deploy e Ambienti

| Ambiente | Branch | URL esempio | Descrizione |
|-----------|---------|-------------|--------------|
| Local | qualsiasi | `localhost:3000` | Test locale |
| Preview (Vercel) | qualsiasi branch | `branchname.vercel.app` | Build automatica su ogni PR |
| Production | `main` | `www.lasoluzione.eu` | Deploy automatico stabile |

### 🔸 Deploy Manuale
Puoi forzare un deploy manuale da Vercel:
1. Vai al progetto in Vercel.  
2. Seleziona il branch (`docs/...` o `feature/...`).  
3. Clicca **Deploy**.  
4. Oppure fai **Re-deploy** di una build esistente.

---

## 5. Best Practice Operative

1. **Non committare su `main`.** Usa sempre branch dedicati.  
2. **Mantieni i branch puliti.** Elimina quelli mergiati o obsoleti.  
3. **Nomina i branch chiaramente**: `feat/admin-bookings`, `docs/audit-2025`.  
4. **Un commit per concetto.**  
5. **Scrivi messaggi descrittivi:** `fix: corregge errore 500 in /contacts`.  
6. **Usa PR anche per piccole modifiche.** Così hai sempre tracciabilità.  
7. **Controlla le preview Vercel** prima del merge.  
8. **Tieni aggiornato il `.env`** sincronizzandolo con Supabase e Vercel.  
9. **Fai test locali prima del push.**  
10. **Aggiorna la documentazione** con ogni modifica strutturale.

---

## 6. Integrazione ChatGPT + Codex + GitHub

| Strumento | Azione | Output |
|------------|---------|---------|
| ChatGPT | genera prompt e roadmap | file testuale o comando per Codex |
| Codex | esegue prompt, modifica codice/doc, apre PR | branch + PR |
| GitHub | riceve PR, gestisce versioni, integra CI/CD | deploy automatico |
| Vercel | build + preview | versione live |
| Supabase | aggiorna schema, API, variabili | database allineato |
| VS Code | editing/test locale | commit locali |
| SiteGround | DNS → dominio online | visibilità pubblica |

---

## 7. Processi di Sviluppo e Deploy

### 🔸 Fase di Sviluppo
1. ChatGPT → prompt → Codex → branch → PR.  
2. PR revisionata → merge → preview → test.  
3. Se ok → merge in `main` → deploy automatico.

### 🔸 Fase di Produzione
1. Merge approvato → Vercel builda `main`.  
2. SiteGround DNS punta a dominio Vercel.  
3. Vercel pubblica nuova release.  
4. Supabase resta sincronizzato con le chiavi e l’API.

### 🔸 Fase di Aggiornamento Locale
1. `git fetch origin`  
2. `git pull origin main`  
3. `pnpm install` (se cambiano dipendenze)  
4. `pnpm dev` per test locale.

---

## 8. Gestione degli Errori e Recovery

- **Errore Vercel Build:** controlla log, correggi PR o re-deploy.  
- **Conflitti Git:** risolvili in locale su VS Code, poi push.  
- **Errore Supabase:** verifica schema e connessioni `.env`.  
- **Errore DNS:** controlla su SiteGround che i record A/CNAME puntino a Vercel.

---

## 9. Conclusione

Seguendo questa guida, puoi:
- Lavorare in sicurezza senza rompere l’ambiente di produzione.  
- Coordinarti facilmente tra ChatGPT, Codex e GitHub.  
- Mantenere documentazione e codice sempre sincronizzati.

Questo file dovrebbe essere incluso in `/docs/WORKFLOW_AND_ENVIRONMENT_GUIDE.md` come riferimento permanente.
