# Bar La Soluzione – README

> **Stato attuale**
>
> - **Frontend**: Home e wizard prenotazione legacy operativi; **banner cookie + centro preferenze** attivi con blocco preventivo **Google Maps**.  
> - **Admin**: area protetta con login via **magic link**.  
> - **Novità**: avviata la migrazione verso **Catalogo/Carrello** (prodotti unificati + sezioni attivabili + assegnazioni).  
> - In fondo trovi **registro attività** e **tabella progresso** aggiornati.

---

## 1) Panoramica del progetto

- **Obiettivo**: landing page del bar con: Header + Logo, Hero con CTA, Programma eventi, Prenotazioni, Newsletter, Footer con contatti/social e mappa (caricata **solo dopo consenso**).
- **Prenotazioni (legacy)**: pagina `/prenota` con **form a step**, validazioni robuste, riepilogo finale e messaggi accessibili.
- **Catalogo/Carrello (nuovo dominio)**: prodotti unificati (piatti, pacchetti evento, ecc.), sezioni visibili a scelta (**Eventi**, **Aperitivo**, **Colazione**, **Pranzo**, **Cena**), assegnazioni prodotto per sezione, primo endpoint pubblico `/api/catalog`. Checkout unico e mail ordine in arrivo.

### Stack
- **Next.js 14 App Router**, **TypeScript**
- **Prisma 6** + **SQLite** (dev)
- **Auth.js** (email magic link)
- **Nodemailer**
- **Zod**, **react-hook-form**, **Zustand**, **Framer Motion**

### Accessibilità
Conforme a **EAA / WCAG 2.2 AA**: focus visibile, target ≥44px, skip link, reduced motion, ruoli ARIA, errori annunciati, struttura semantica.

### GDPR / ePrivacy
**Banner cookie** con consenso granulare (essenziali/funzionali/analitici/marketing), **blocco preventivo** (Maps/analytics), **Centro preferenze** e **revoca** dal footer. **Versioning del consenso** previsto.

### CMS (fase 2)
Adapter previsto per **Strapi/Directus/Sanity** con normalizzazione e **fallback locale**.

---

## 2) Novità Catalogo/Carrello (fase 1 completata)

**Schema Prisma (nuovo)**  
`Product`, `CatalogSection`, `SectionProduct`, `EventInstance`, `Cart`, `CartItem`, `Order`.  
Bridge col legacy possibile via `Booking.orderId`.

**Pagine Admin nuove**
- `/admin/catalog/products` — elenco/ricerca prodotti, flag nutrizionali, attivo/inattivo.
- `/admin/catalog/sections` — attiva/disattiva sezioni, **enableDateTime** (solo **pranzo/cena**), **displayOrder**, assegnazioni prodotti (featured/home) con **toast**.

**API nuove**
- Pubblico: `GET /api/catalog` — sezioni attive con prodotti assegnati (DTO tipizzato).
- Admin:  
  `GET/POST /api/admin/products` · `POST /api/admin/sections` · `POST/DELETE /api/admin/sections/:id/products`

**Da fare (fase 2+)**
- REST carrello: `/api/cart`, `/api/cart/items`
- Checkout: `/api/orders` (pagamento o auto-conferma se totale = 0 €)
- UI pubblica “accordion” (Eventi, Aperitivo, Colazione, Pranzo, Cena) con **carrello persistente**
- Mail da `Order`/`CartItem` (cliente + admin)
- Bridge temporaneo nuovo → DTO legacy per coesistenza col wizard

---

## 3) Struttura delle cartelle

```
bar-landing/
├─ public/
├─ src/
│  ├─ app/
│  │  ├─ (site)/{layout.tsx,page.tsx,globals.css}
│  │  ├─ prenota/page.tsx                 # wizard legacy
│  │  ├─ admin/
│  │  │  ├─ signin/page.tsx
│  │  │  ├─ page.tsx                      # dashboard legacy
│  │  │  ├─ menu/dishes/page.tsx          # legacy
│  │  │  ├─ tiers/page.tsx                # legacy
│  │  │  └─ catalog/
│  │  │     ├─ products/page.tsx          # nuovo
│  │  │     └─ sections/page.tsx          # nuovo (server loader + client UI)
│  │  └─ api/…                            # rotte legacy + nuove
│  ├─ components/
│  │  ├─ accessibility/SkipLink.tsx
│  │  ├─ cookies/{CookieBar,PreferencesModal}.tsx
│  │  ├─ layout/ConsentScripts.tsx        # placeholder
│  │  ├─ map/DeferredMap.tsx
│  │  ├─ booking/…                        # wizard legacy
│  │  └─ admin/
│  │     ├─ ui/toast.tsx                  # ToastProvider + useToast
│  │     └─ catalog/SectionsPageClient.tsx# client-only per /sections
│  ├─ lib/{prisma.ts,mailer.ts,auth.ts,…}
│  ├─ state/useCookieUI.ts
│  └─ middleware.ts
├─ prisma/{schema.prisma,migrations/,seed.ts}
├─ docs/                                  # documentazione aggiornata
├─ next.config.mjs
├─ package.json
├─ tsconfig.json
└─ README.md
```

---

## 4) Librerie principali

UI & Animazioni: `react`, `framer-motion`  
Form & Validation: `react-hook-form`, `zod`, `@hookform/resolvers`  
State: `zustand` · MDX legali: `@next/mdx`  
Lint/format: `eslint`, `prettier`, `stylelint`

---

## 5) Setup e comandi

```bash
pnpm i
cp .env.example .env.local   # configura AUTH + mail
pnpm prisma migrate dev
pnpm seed
pnpm dev                     # http://localhost:3000
```

**Script**
```json
{
  "dev": "next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint .",
  "type-check": "tsc --noEmit",
  "prisma:generate": "prisma generate",
  "seed": "prisma db seed"
}
```

---

## 6) Auth & Admin

- **Auth.js** (NextAuth v5) con **magic link**.
- Variabili (`.env.local`):
  - `NEXTAUTH_URL`, `NEXTAUTH_SECRET`
  - `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`
  - `MAIL_FROM`
  - `ADMIN_EMAILS` (lista whitelisted)
- Middleware protegge `/admin/*` e `/api/admin/*` con redirect a `/admin/signin`.

---

## Payments (Revolut)

- Configura le variabili sandbox in `.env.local` copiandole da `.env.example`: `REVOLUT_SECRET_KEY`, `REVOLUT_API_VERSION`, `REVOLUT_API_BASE`, `PAY_RETURN_URL`, `PAY_CANCEL_URL`, `NEXT_PUBLIC_BASE_URL` (puntano all'ambiente sandbox e all'URL locale).
- Tutte le chiamate verso l'API Merchant devono includere `Authorization: Bearer …` e `Revolut-Api-Version: 2024-09-01`; gli endpoint vivono sotto `https://sandbox-merchant.revolut.com/api/*` (produzione: `https://merchant.revolut.com/api/*`).
- Il widget si inizializza con il token dell'ordine: `await RevolutCheckout(orderToken, 'sandbox')` e `instance.payWithPopup({ onSuccess, onError, onCancel })`.
- Flusso checkout MVP: `/api/payments/checkout` → widget Revolut → `/checkout/return` → `/api/payments/order-status`.
- Nessun webhook richiesto per l'MVP; si possono aggiungere in seguito per la riconciliazione ordini/pagamenti.
- Testa i pagamenti con le carte sandbox (successo + errori, importi ≥ €30 per scenari 3DS).
- Riferimenti utili: [API versioning](https://developer.revolut.com/docs/merchant/api/versioning), [Checkout init](https://developer.revolut.com/docs/merchant/web/overview#initialise-revolutcheckout), [payWithPopup](https://developer.revolut.com/docs/merchant/web/checkout#popup-integration), [test cards](https://developer.revolut.com/docs/merchant/test-cards).

---

## 7) Endpoints (selezione)

**Pubblico (legacy)**  
`GET /api/booking-config` · `POST /api/bookings` · `POST /api/bookings/prepay`

**Pubblico (nuovo)**  
`GET /api/catalog`

**Admin (legacy)**  
Menu dishes, tiers, settings…

**Admin (nuovo)**  
`GET/POST /api/admin/products`  
`POST /api/admin/sections`  
`POST/DELETE /api/admin/sections/:id/products`

---

## 8) Progress Tracker

| Area | Stato | Cosa abbiamo fatto | Prossimi step |
|---|---|---|---|
| Boot & tooling | ✅ | App Router `/src`, alias `@/*`, setup pnpm | TS `strict`, lint rules |
| Routing base | ✅ | Home stub, middleware | Sezioni Home (Hero/Eventi/Newsletter) |
| Cookie & consenso | ✅ | Banner + Centro preferenze, blocco Maps | Versioning consenso, `ConsentScripts` reali |
| ConsentScripts | 🟨 | Placeholder | Montare GA4/pixel in base alle categorie |
| Prenotazioni (legacy) | ✅ | Wizard Step1–4 + validazioni | In futuro sostituzione col checkout |
| Catalogo/Carrello | 🟨 | **Schema + Admin Products/Sections + `/api/catalog`** | `/api/cart`, `/api/orders`, UI pubblica + checkout |
| Accessibilità | 🟨 | SkipLink, focus modal | Focus ring globali, target ≥44px |
| SEO | ⛔️ | — | Metadata, OG/Twitter, JSON-LD, `sitemap.ts` |
| Pagine legali | 🟨 | Link predisposti | `/privacy`, `/cookie-policy` in MDX |
| CMS (fase 2) | ⛔️ | — | Adapter + fallback |
| Sicurezza | 🟨 | Middleware base | CSP/Headers in `next.config.mjs` |
| Build & deploy | ⛔️ | — | `next build`, `.env.example`, hosting/CDN |

Legenda: ✅ fatto · 🟨 parziale · ⛔️ da fare

---

## 9) Troubleshooting

- **Prisma P3006/P3015 (shadow/missing migration)**  
  Elimina directory migrazioni senza `migration.sql`, poi:  
  `pnpm prisma migrate dev` **oppure** `pnpm prisma migrate reset --force && pnpm seed`.
- **Hook React in SSR**  
  Pagine client-only (es. `SectionsPageClient.tsx`) devono avere `"use client"` ed essere importate in una pagina server che **non** usa hook.
- **Toast**  
  Usa `useToast()` **solo** sotto `<ToastProvider>` (già integrato in `SectionsPageClient`).

---

## 10) Registro attività (estratto)

- Setup Next + TS + alias `@/*`, librerie form/state/animazioni.  
- Banner cookie + Preferences modal + blocco Maps (consenso).  
- Wizard prenotazioni con validazioni zod.  
- Admin auth (magic link), dashboard legacy.  
- **Nuovo**: modello **Catalogo/Carrello** (Prisma), admin **Products** e **Sections** con assegnazioni/ordinamento/toast, endpoint **`GET /api/catalog`**.
- Fix import alias e pulizia vari.

---

## 11) Roadmap

1. `/api/cart`, `/api/cart/items` (token, CRUD, TTL)  
2. `/api/orders` (checkout, pagamento/auto-conferma 0€)  
3. UI pubblica “accordion” + carrello persistente + slot `EventInstance`  
4. Email ordine: cliente + admin (HTML+testo)  
5. Bridge: mappare nuovi dati → DTO legacy finché il wizard resta attivo  
6. CMS adapter, SEO/MDX legali, headers sicurezza

---

## Licenza
© 2025 Bar La Soluzione Di Rave Samuel. Tutti i diritti riservati.

Questo progetto è **proprietario**. Non è consentito copiare, modificare,
distribuire o riutilizzare il codice e i contenuti, in tutto o in parte,
senza autorizzazione scritta del titolare. Per informazioni: info@lasoluzione.eu.
