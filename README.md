# Bar Landing – README

> **Stato**: blueprint completo per avviare il progetto. Segui la checklist in basso per implementare in modo ordinato tutte le funzionalità.

---

## 1) Panoramica del progetto

* **Obiettivo**: realizzare una **landing page** per un bar con: Header con logo; Hero con CTA e immagine; Programma dei prossimi eventi; Sezione “Prenota il tuo pranzo / evento”; Iscrizione newsletter; Footer con contatti, social e **mappa Google** (caricata **solo** dopo consenso ai cookie non essenziali).
* **Prenotazioni**: pagina dedicata `/prenota` con **form avanzato a step**, validazioni robuste, riepilogo finale e messaggi di errore accessibili.
* **Stack**: **Next.js 14+** (App Router) con **TypeScript**, **SSR/SSG** per performance e SEO, build production e struttura **/src**.
* **Accessibilità**: conforme a **EAA / WCAG 2.2 livello AA** (focus visibile, target ≥44px, skip link, reduced motion, ruoli ARIA corretti, errori annunciati, struttura semantica).
* **GDPR / ePrivacy**: **banner cookie** con consenso granulare (essenziali, funzionali, analitici, marketing), **blocco preventivo** di risorse non essenziali (es. Google Maps, analytics), **Centro preferenze** accessibile (modal) e possibilità di **revoca**. **Versioning** del consenso. **Newsletter** con **doppio opt‑in**.
* **CMS headless (fase 2)**: adapter pronto per **Strapi / Directus / Sanity** con normalizzazione dati e **fallback locale**. Configurazione attraverso `window.__CMS__` caricata in modo sicuro dal layout.

> **Perché Next.js (vs Vite)?** Next offre **SSR/SSG** nativi, routing file‑system, meta/SEO per pagina, `next/script` per **caricamento condizionale** (utile per il blocco GDPR), Image Optimization e un’ottima base per evolvere in **sito vetrina + backend**.

---

## 2) Requisiti chiave

* **Design**: sfondo **bianco**, testi e elementi grafici con colore **#112f4d**; linee divisorie e **cerchi** come elementi puramente decorativi (non informativi).
* **Animazioni**: **Framer Motion** con rispetto di `prefers-reduced-motion`.
* **SEO**: meta di base + Open Graph/Twitter, **JSON‑LD** (LocalBusiness + Event), sitemap/robots, canonical.
* **Mappa**: placeholder accessibile; iframe/script Google Maps **caricato solo dopo consenso** (categoria “funzionali/marketing” a seconda del DPIA).
* **Form**: `react-hook-form` + `zod` per validazioni; errori annunciati con `aria-live="assertive"`; riepilogo finale; step con indicatori accessibili.
* **Contenuti Eventi**: prima locale (mock), poi da CMS via adapter con normalizzazione.

---

## 3) Struttura delle cartelle (albero)

```
bar-landing/
├─ public/
│  ├─ fonts/
│  ├─ images/
│  │  ├─ hero.jpg
│  │  ├─ logo.svg
│  │  └─ placeholders/
│  ├─ icons/
│  ├─ manifest.webmanifest
│  └─ cms-config.example.js     # esempio di configurazione window.__CMS__
├─ src/
│  ├─ app/
│  │  ├─ (site)/
│  │  │  ├─ layout.tsx          # Layout principale + Script config CMS + SkipLink + CookieBar
│  │  │  ├─ page.tsx            # Landing (SSG)
│  │  │  └─ globals.css         # Stili globali (CSS vars, colori, tipografia, utility a11y)
│  │  ├─ prenota/
│  │  │  └─ page.tsx            # Form multi-step (SSR/SSG)
│  │  ├─ privacy/
│  │  │  └─ page.mdx            # Contenuti legali base, pronti per personalizzazione
│  │  ├─ cookie-policy/
│  │  │  └─ page.mdx            # Idem
│  │  ├─ api/
│  │  │  └─ newsletter/route.ts # endpoint mock per doppio opt-in (fase 1)
│  │  └─ sitemap.ts             # sitemap dinamica
│  ├─ components/
│  │  ├─ accessibility/
│  │  │  ├─ SkipLink.tsx
│  │  │  └─ VisuallyHidden.tsx
│  │  ├─ ui/
│  │  │  ├─ Button.tsx
│  │  │  ├─ Divider.tsx         # linee decorative
│  │  │  └─ Circle.tsx          # cerchi decorativi
│  │  ├─ layout/
│  │  │  ├─ Header.tsx
│  │  │  ├─ Footer.tsx
│  │  │  └─ ConsentScripts.tsx  # monta script condizionali in base al consenso
│  │  ├─ hero/Hero.tsx
│  │  ├─ events/
│  │  │  ├─ EventsList.tsx
│  │  │  └─ EventCard.tsx
│  │  ├─ booking/
│  │  │  ├─ BookingWizard.tsx   # stepper + form
│  │  │  ├─ steps/
│  │  │  │  ├─ Step1Date.tsx
│  │  │  │  ├─ Step2People.tsx
│  │  │  │  ├─ Step3Details.tsx
│  │  │  │  └─ Step4Review.tsx
│  │  │  └─ validation.ts        # zod schemas
│  │  ├─ newsletter/NewsletterForm.tsx
│  │  └─ map/DeferredMap.tsx     # placeholder + load on consent
│  ├─ lib/
│  │  ├─ seo.ts                  # helpers SEO + JSON-LD
│  │  ├─ a11y.ts                 # helpers a11y (reduced motion, focus ring)
│  │  ├─ cookies/
│  │  │  ├─ consent.ts           # logica consenso + versioning
│  │  │  └─ categories.ts        # definizione categorie e chiavi
│  │  ├─ cms/
│  │  │  ├─ adapter.ts           # interfaccia comune
│  │  │  ├─ strapi.ts            # adapter Strapi
│  │  │  ├─ directus.ts          # adapter Directus
│  │  │  └─ sanity.ts            # adapter Sanity
│  │  ├─ cms/normalizers.ts      # normalizzazione dati -> types condivisi
│  │  ├─ http.ts                 # fetch wrapper con AbortController
│  │  └─ types.ts                # tipi condivisi (Event, Venue, Consent, ecc.)
│  ├─ styles/
│  │  ├─ tokens.css              # CSS custom properties (colori, spaziature)
│  │  ├─ utilities.css           # helper classes (visually-hidden, focus-ring, ecc.)
│  │  └─ components/*.css        # CSS Modules opzionali
│  ├─ state/
│  │  └─ useConsentStore.ts      # zustand store per consenso (client-side)
│  └─ middleware.ts              # blocco preventivo lato server (headers, CSP, cookies)
├─ .env.example
├─ next.config.mjs
├─ package.json
├─ tsconfig.json
├─ .eslintrc.cjs
├─ .prettierrc
├─ .stylelintrc.cjs
└─ README.md
```

> **Nota**: in Next.js non esiste un `index.html` classico. La configurazione `window.__CMS__` verrà iniettata dal `layout.tsx` tramite `<Script>` o `dangerouslySetInnerHTML`, replicando lo stesso risultato.

---

## 4) Librerie principali

* **UI & Animazioni**: `react`, `framer-motion` (rispetto prefers-reduced-motion).
* **Form & Validation**: `react-hook-form`, `zod`, `@hookform/resolvers`.
* **SEO**: API `metadata` dell’App Router + helper in `lib/seo.ts`.
* **State mgmt (consenso)**: `zustand`.
* **MDX pagine legali**: `@next/mdx`.
* **Testing** (facoltativo in fase 1): `vitest` + `@testing-library/react`.

---

## 5) Accessibilità (WCAG 2.2 AA)

* **Struttura semantica**: landmark (`header`, `nav`, `main`, `footer`), headings in ordine logico.
* **Skip link**: visibile al focus, porta all’`#main`.
* **Focus**: indicatori **chiari** (colore #112f4d + outline contrastato).
* **Target**: pulsanti/link ≥ **44×44 px**.
* **Form**: label associate, istruzioni prima dell’input, errori con `aria-live` e `aria-describedby`.
* **Riduzione Motion**: disabilita/semplifica animazioni se `prefers-reduced-motion`.
* **Contrasto**: testo #112f4d su bianco > AA.
* **Tastiera**: modali (consenso) con **focus trap** e chiusura con `Esc`.

---

## 6) GDPR / ePrivacy

* **Categorie**: `essential`, `functional`, `analytics`, `marketing`.
* **Banner**: descrizioni chiare + link a **Centro preferenze** (modal).
* **Blocco preventivo**: **non** caricare Google Maps, analytics, pixel, ecc. finché non c’è consenso.
* **Caricamento condizionale**: usare `next/script` e `ConsentScripts.tsx` per montare script **solo** se il consenso relativo è `true`.
* **Versioning**: salvare cookie `consent_v<SEMVER>` (es. `consent_v1.0.0`) con timestamp e policyVersion. Se cambia la policy → invalidare e richiedere nuovamente il consenso.
* **Revoca**: link persistente “**Gestisci cookie**” nel footer, apre la modal per modificare le preferenze.
* **Registro**: opzionale endpoint server per persistere log del consenso (ip troncato, user‑agent, timestamp).
* **Newsletter**: iscrizione con **double opt‑in** (invio email di conferma; iscrizione attiva solo dopo conferma).

---

## 7) SEO & Dati Strutturati

* **Metadata**: titolo, descrizione, canonical, robots per pagina.
* **Open Graph** e **Twitter Cards**.
* **JSON‑LD**: `LocalBusiness` (bar/café) + `Event` per gli eventi futuri.
* **Sitemap**: `src/app/sitemap.ts`.
* **Immagini**: `next/image` con `alt` descrittivi.

---

## 8) Flusso pagina **/prenota** (multi‑step)

1. **Data & orario** (selezione giorno/orario disponibili).
2. **Persone & tipologia** (pranzo, aperitivo, evento privato).
3. **Dettagli** (nome, email, telefono, note, preferenze accessibilità, allergie).
4. **Riepilogo & consenso** (termini, privacy, marketing opzionale).

* Validazioni con `zod`; pulsanti `Avanti/Indietro` con stato disabilitato se invalido.
* Indicatori step con ruoli ARIA (`aria-current="step"`).
* **Errore**: annunciato in `aria-live`.

---

## 9) Adattatore CMS (fase 2)

* **Interfaccia comune** `CmsAdapter` con metodi: `getEvents`, `getEventBySlug`, `getSettings`.
* **Normalizzazione** in `normalizers.ts` verso tipo `Event`:

  ```ts
  type Event = {
    id: string; title: string; slug: string; startsAt: string; endsAt?: string;
    description?: string; cover?: string; venue?: { name?: string; address?: string };
    tags?: string[]; ticketUrl?: string;
  }
  ```
* **Config runtime**: nel `layout.tsx` iniettare uno script che legge `window.__CMS__` (proveniente da `public/cms-config.example.js` copiato/variato in produzione) e seleziona l’adapter.
* **Fallback**: se il CMS non risponde → usa mock locale dagli `events.mock.json`.

**Esempio `public/cms-config.example.js`:**

```js
// Questo file viene copiato e personalizzato senza rebuild.
window.__CMS__ = {
  provider: "strapi",             // "directus" | "sanity"
  baseUrl: "https://cms.example.com",
  token: "<read-only-token>",
  locale: "it-IT",
};
```

---

## 10) Sicurezza & Performance

* **CSP** (Content Security Policy) via `middleware.ts` e headers in `next.config.mjs`, con placeholder per domini di terze parti (Maps, analytics).
* **Preload** font e immagini critiche.
* **Immagini** ottimizzate, `priority` in hero.
* **Lazy** per sezioni non above‑the‑fold (mappa, eventi).

---

## 11) Script NPM

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

## 12) Checklist di implementazione (passo‑passo)

### A. Bootstrap & base progetto

* [ ] Inizializza repo: `pnpm create next-app bar-landing --ts --src-dir --app --eslint`.
* [ ] Configura `next.config.mjs` con `images.domains` e headers di sicurezza (CSP di base, `Referrer-Policy`, `Permissions-Policy`).
* [ ] Aggiungi `framer-motion`, `react-hook-form`, `zod`, `zustand`, `@next/mdx`, `prettier`, `stylelint`.
* [ ] Imposta `globals.css`, `tokens.css`, `utilities.css` (colori, focus ring, visually-hidden, spacing).
* [ ] Implementa `SkipLink` e focus styles globali (contrastati).

### B. Layout & componenti core

* [ ] `Header` (logo SVG, nav con link ancore: #eventi, #prenota, #newsletter, #contatti).
* [ ] `Hero` con CTA primaria “Prenota ora” e immagine sotto; cerchi/linee decorative (solo CSS).
* [ ] Sezione **Eventi** con `EventsList` (mock locale).
* [ ] Sezione **Prenota** (teaser) con bottone verso `/prenota`.
* [ ] Sezione **Newsletter** con form (email) + testi su double opt‑in.
* [ ] **Footer**: contatti, social, link legali, bottone “Gestisci cookie”, mappa **defer** (placeholder + caricamento su consenso).

### C. SEO & dati strutturati

* [ ] Helpers `lib/seo.ts`: meta base, OG/Twitter, JSON‑LD `LocalBusiness` + `Event`.
* [ ] `sitemap.ts` e `robots.txt` (statico in `public/`).

### D. Cookie banner & Centro preferenze

* [ ] Stato centrale `useConsentStore` (zustand) con schema: `{ policyVersion, timestamp, categories: { essential: true, functional: boolean, analytics: boolean, marketing: boolean } }`.
* [ ] `CookieBar` (banner): descrizione, link policy, pulsanti **Accetta tutto / Rifiuta / Preferenze**.
* [ ] `PreferencesModal` (modal accessibile con focus trap).
* [ ] **Versioning**: costante `POLICY_VERSION = "1.0.0"`; se cambia → invalidare consenso.
* [ ] `ConsentScripts.tsx`: monta **solo** gli script consentiti (es. analytics) con `next/script`.
* [ ] **Blocco Maps**: `DeferredMap` mostra callout e bottone “Attiva mappa (consenso funzionali/marketing)”.

### E. Pagina `/prenota` (form multi‑step)

* [ ] `BookingWizard` con step 1‑4; indicatori step ARIA; pulsanti con target ≥44px.
* [ ] Validazioni `zod` (email, telefono, data futura, n. persone, consensi).
* [ ] Messaggi errore `aria-live`, `aria-invalid`, `aria-describedby`.
* [ ] Riepilogo finale + CTA “Conferma richiesta”.
* [ ] Mock serverless `api/newsletter` e (opz.) `api/booking` per test.

### F. Pagine legali

* [ ] `/privacy` e `/cookie-policy` in MDX con contenuti **base** commentati (placeholder legali).
* [ ] Inserisci riferimenti a **titolare del trattamento**, finalità, basi giuridiche, tempi conservazione, diritti interessati, contatti DPO (se presente).

### G. CMS (fase 2)

* [ ] Inserisci `public/cms-config.example.js` e caricalo in `layout.tsx`.
* [ ] Implementa `lib/cms/adapter.ts` + `strapi.ts` / `directus.ts` / `sanity.ts`.
* [ ] `EventsList` legge prima da CMS; se errore → fallback mock.
* [ ] Documenta mapping campi e normalizzazione.

### H. QA, A11y & Performance

* [ ] Lighthouse ≥ 95 (Performance/SEO/Best Practices) e **Accessibility ≥ 95**.
* [ ] Test tastiera (banner, modal, form step).
* [ ] Mobile target touch ≥44px; hit‑slop adeguato.
* [ ] Verifica `prefers-reduced-motion`.
* [ ] Verifica blocco preventivo script di terze parti.

### I. Build & Deploy

* [ ] `next build` & `next start`.
* [ ] Imposta variabili `.env` (URL CMS, API newsletter).
* [ ] CDN per assets, HTTP/2, compressione Brotli.

---

## 13) Note di implementazione (commenti da aggiungere nel codice)

* **Header `<head>`/SEO**: commentare punti dove inserire meta extra, link a immagini social, JSON‑LD aggiuntivi, canonical dinamico.
* **Servizi esterni**: commentare placeholder per ID Analytics, API Maps key, endpoint newsletter.
* **Immagini**: commentare dove sostituire hero e logo.
* **CMS**: commentare in `layout.tsx` come leggere `window.__CMS__` e selezionare adapter.
* **Form**: commentare i campi obbligatori/opzionali e dove estendere validazioni.

---

## 14) Convenzioni di stile

* **TypeScript** rigoroso (`strict: true`).
* **CSS**: tokens in `tokens.css`; classi utilitarie in `utilities.css`; component‑scoped ove utile.
* **Nomi**: PascalCase per componenti, camelCase per variabili, SCREAMING\_SNAKE\_CASE per costanti globali.

---

## 15) Roadmap futura

* Integrazione reale con CMS e backend prenotazioni.
* Autenticazione (es. Clerk/Auth.js) per pannello staff.
* Calendario eventi con filtri.
* i18n (it/en).
* Test E2E (Playwright).

---

## 16) Come iniziare

1. Clona repo e installa: `pnpm i`.
2. Copia `.env.example` in `.env.local` e imposta variabili.
3. `pnpm dev` → [http://localhost:3000](http://localhost:3000)
4. Implementa la **Checklist** in ordine, spuntando ogni item.


## Licenza
© 2025 Bar La >Soluzione Di Rave Samuel. Tutti i diritti riservati.

Questo progetto è **proprietario**. Non è consentito copiare, modificare,
distribuire o riutilizzare il codice e i contenuti, in tutto o in parte,
senza autorizzazione scritta del titolare. Per informazioni: info@lasoluzione.eu.
