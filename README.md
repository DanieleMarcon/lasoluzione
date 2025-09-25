# Bar La Soluzione – README

> **Stato attuale**: ambiente avviato, routing base attivo, **banner cookie + centro preferenze** integrati (UI), **blocco preventivo Google Maps** attivo, **wizard prenotazione** operativo (client-side). In fondo trovi **registro attività** completo e **tabella progresso** con ciò che resta da fare.

---

## 1) Panoramica del progetto

* **Obiettivo**: realizzare una **landing page** per un bar con: Header con logo; Hero con CTA e immagine; Programma dei prossimi eventi; Sezione “Prenota il tuo pranzo / evento”; Iscrizione newsletter; Footer con contatti, social e **mappa Google** (caricata **solo** dopo consenso ai cookie non essenziali).
* **Prenotazioni**: pagina dedicata `/prenota` con **form avanzato a step**, validazioni robuste, riepilogo finale e messaggi di errore accessibili.
* **Stack**: **Next.js 14+** (App Router) con **TypeScript**, **SSR/SSG** per performance e SEO, build production e struttura **/src**.
* **Accessibilità**: conforme a **EAA / WCAG 2.2 AA** (focus visibile, target ≥44px, skip link, reduced motion, ruoli ARIA corretti, errori annunciati, struttura semantica).
* **GDPR / ePrivacy**: **banner cookie** con consenso granulare (essenziali, funzionali, analitici, marketing), **blocco preventivo** (es. Google Maps, analytics), **Centro preferenze** e **revoca** dal footer. **Versioning** del consenso.
* **CMS headless (fase 2)**: adapter pronto per **Strapi / Directus / Sanity** con normalizzazione dati e **fallback locale**.

---

## 2) Progress Tracker (cosa è fatto / cosa resta)

| Area | Stato | Cosa abbiamo fatto | Prossimi step |
|---|---|---|---|
| Boot & tooling | ✅ | Struttura App Router `src/`, `tsconfig` con alias `@/*`, `.gitignore` pulito, `pnpm` installazioni principali. | Allineare Next 15 quando opportuno; attivare `strict` TS. |
| Routing base | ✅ | `src/app/(site)/page.tsx` (home stub), middleware pass-through. | Sottosezioni Home: Hero, Eventi, Prenota teaser, Newsletter. |
| Cookie & consenso | ✅ | `CookieBar`, `PreferencesModal`, store UI, footer “Gestisci cookie”. | Aggiungere **versioning** del consenso e persistenza definitiva; wiring con `useConsentStore` (non solo UI). |
| Blocchi su consenso | ✅ | `DeferredMap` carica iframe Maps **solo dopo consenso** funzionali/marketing. | Integrare analytics/pixel reali in `ConsentScripts`. |
| ConsentScripts | 🟨 | File presente come **placeholder**. | Montare script reali (es. GA4) in base alle categorie scelte. |
| Prenotazioni | ✅ | `BookingWizard` con step 1-4 + `validation.ts`; pagina `/prenota` aggiornata. | Endpoint server (`/api/booking`), salvataggio e-mail di conferma, rate-limit anti-spam. |
| Accessibilità | 🟨 | `SkipLink` presente, focus management nella modal. | Focus ring globali, target 44px ovunque, audit tastiera completo. |
| SEO | ⛔️ | — | Metadata per pagina, OG/Twitter, JSON-LD (LocalBusiness/Event), `sitemap.ts`. |
| Pagine legali | 🟨 | Link predisposti dalla Home. | Creare `/privacy` e `/cookie-policy` in **MDX** e collegare i testi al banner. |
| CMS (fase 2) | ⛔️ | — | `public/cms-config.example.js`, adapter + normalizzazione e fallback mock. |
| Sicurezza | 🟨 | Middleware base. | CSP e security headers in `next.config.mjs`; `Permissions-Policy`, `Referrer-Policy`. |
| Build & deploy | ⛔️ | — | `next build`, `.env.example`, hosting + CDN. |

Legenda: ✅ fatto · 🟨 parziale · ⛔️ da fare

---

## 3) Struttura delle cartelle (albero)

```
bar-landing/
├─ public/
├─ src/
│  ├─ app/
│  │  ├─ (site)/
│  │  │  ├─ layout.tsx
│  │  │  ├─ page.tsx
│  │  │  └─ globals.css
│  │  ├─ prenota/
│  │  │  └─ page.tsx
│  │  └─ sitemap.ts               # (da implementare)
│  ├─ components/
│  │  ├─ accessibility/SkipLink.tsx
│  │  ├─ cookies/{CookieBar,PreferencesModal}.tsx
│  │  ├─ layout/{ConsentScripts}.tsx
│  │  ├─ map/DeferredMap.tsx
│  │  └─ booking/
│  │     ├─ BookingWizard.tsx
│  │     ├─ steps/{Step1Date,Step2People,Step3Details,Step4Review}.tsx
│  │     └─ validation.ts
│  ├─ state/
│  │  └─ useCookieUI.ts           # store UI per Centro preferenze
│  └─ middleware.ts
├─ next.config.mjs
├─ package.json
├─ tsconfig.json
└─ README.md
```

---

## 4) Librerie principali

* **UI & Animazioni**: `react`, `framer-motion`
* **Form & Validation**: `react-hook-form`, `zod`, `@hookform/resolvers`
* **State mgmt (consenso/UI)**: `zustand`
* **MDX legali**: `@next/mdx` (già in devDependencies)
* **Lint/format**: `eslint`, `prettier`, `stylelint`

---

## 5) Checklist di implementazione (con stato)

### A. Bootstrap & base progetto
- [x] Inizializza repo Next + TypeScript con `/src`.
- [x] Alias `@/*` → `src/*` in `tsconfig.json`.
- [x] `.gitignore` (esclude `node_modules`, `.next`, build).
- [x] Pacchetti: `framer-motion`, `react-hook-form`, `zod`, `zustand`.
- [ ] **TS strict** e regole ESLint perfezionate.

### B. Layout & componenti core
- [x] Home stub `page.tsx`.
- [x] Footer con “Gestisci cookie”.
- [x] `DeferredMap` con caricamento condizionato su consenso.
- [ ] Header, Hero, Eventi, Newsletter.

### C. SEO & dati strutturati
- [ ] Helpers `lib/seo.ts`.
- [ ] Metadata, OG/Twitter, JSON-LD (LocalBusiness/Event).
- [ ] `sitemap.ts` e `robots.txt`.

### D. Cookie banner & Centro preferenze
- [x] `CookieBar` (banner) + `PreferencesModal` (modal).
- [x] Blocco Maps finché non c’è consenso.
- [ ] Versioning del consenso + persistenza robusta.
- [ ] `ConsentScripts`: montare analytics/pixel reali.

### E. Pagina `/prenota`
- [x] `BookingWizard` + validazioni `zod`.
- [ ] Endpoint `/api/booking` (mock → reale).

### F. Pagine legali
- [ ] `/privacy` e `/cookie-policy` in MDX, copy base IT.
- [ ] Aggiornare link nel banner.

### G. CMS (fase 2)
- [ ] `public/cms-config.example.js` + iniezione runtime.
- [ ] Adapter (Strapi/Directus/Sanity) + normalizzazione.
- [ ] Fallback mock se CMS non risponde.

### H. QA, A11y & Performance
- [ ] Focus ring globali, target ≥44px.
- [ ] Audit tastiera su tutte le UI.
- [ ] Lighthouse ≥95 e Accessibility ≥95.

### I. Build & Deploy
- [ ] `next build` & `start` OK.
- [ ] `.env.example` + `.env.local`.
- [ ] Deploy + CDN.

---

## 6) Come proseguire subito (ordine consigliato)

1. **SEO base**: metadata + `sitemap.ts`.
2. **Pagine legali** (MDX) e collegamento al banner.
3. **ConsentScripts**: abilitare GA4 (se previsto) leggendo le categorie.
4. **Hero/Eventi/Newsletter** in Home (mock).
5. **Endpoint `/api/booking`** e messaggio di conferma.
6. **Focus ring & a11y pass** (tastiera e `prefers-reduced-motion`).

---

## 7) Registro attività (storico)

* Setup iniziale progetto Next (App Router, TS, `/src`).
* Aggiunti pacchetti: `react-hook-form`, `zod`, `@hookform/resolvers`, `zustand`, `framer-motion`.
* Creati componenti **cookie**: `CookieBar`, `PreferencesModal`; store **UI** `useCookieUI`.
* Footer patchato: bottone **“Gestisci cookie”** apre Centro preferenze.
* Implementato `DeferredMap`: carica iframe Google Maps **solo dopo consenso** funzionali/marketing.
* Creato `BookingWizard` con step (`Step1Date`, `Step2People`, `Step3Details`, `Step4Review`) e `validation.ts`.
* Aggiornata `/prenota` per usare `BookingWizard`.
* Sistemati import con alias `@/*` e fix massivo `@/src/... → @/...`.
* Creato `SkipLink` e collegato nel layout.
* Risolta build error in `ConsentScripts` sostituendolo con **placeholder** (in attesa di script reali).
* Aggiunti `.gitignore` e middleware pass-through (`src/middleware.ts`).
* Aggiornata **Licenza** a `UNLICENSED` / progetto proprietario; README con sezione licenza.

---

## 8) Script NPM

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "type-check": "tsc --noEmit",
    "format": "prettier --write ."
  }
}
```

---

## 9) Note di implementazione

* **ConsentScripts**: il file è un **placeholder**; quando si inseriscono script reali, usare `next/script` e montare solo se `categories.analytics` (o la categoria pertinente) è `true`.  
* **Versioning consenso**: definire `POLICY_VERSION` e invalidare il cookie quando cambia.  
* **A11y**: assicurare `aria-live` per errori form, `aria-describedby` e focus trap nelle modali.  
* **Maps**: l’iframe viene creato solo dopo consenso; fino ad allora mostra un placeholder accessibile.  

---

## 10) Roadmap futura

* Integrazione reale con CMS e backend prenotazioni.
* Autenticazione staff.
* Calendario eventi con filtri.
* i18n (it/en).
* Test E2E (Playwright).

---

## 11) Come iniziare

1. Clona repo e installa: `pnpm i`.
2. Copia `.env.example` in `.env.local` e imposta variabili.
3. `pnpm dev` → apri http://localhost:3000.
4. Segui la **Checklist** e spunta gli item.

---

## Licenza
© 2025 Bar La >Soluzione Di Rave Samuel. Tutti i diritti riservati.

Questo progetto è **proprietario**. Non è consentito copiare, modificare,
distribuire o riutilizzare il codice e i contenuti, in tutto o in parte,
senza autorizzazione scritta del titolare. Per informazioni: info@lasoluzione.eu.
