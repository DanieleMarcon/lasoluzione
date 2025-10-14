# Audit Responsività Mobile — 2025-02-14

## Sommario esecutivo
- **Punti di forza**: layout principali ancorati a `max-w-7xl` con spacing coerente; componenti chiave (hero, lista eventi, newsletter) riducono correttamente la complessità su view ≤768px grazie a `flex`/`grid` con breakpoint `sm`/`md`; navigazione mobile con menu `md:hidden` e stati focus gestiti su `Header` (`src/components/site/Header.tsx`).
- **Rischi**: il nuovo colore header (`#004177`) non è allineato con gli offset ring (rimasti `#2596be`), potenziale incoerenza visiva; il modale preferenze cookie (`src/components/cookies/PreferencesModal.tsx`) non blocca lo scroll di background sui device piccoli; il banner cookie fisso non considera la safe-area iOS.
- **Priorità**: uniformare gli `focus-visible:ring-offset` del menu, aggiungere scroll-lock e safe-area padding ai componenti cookie, verificare interplay banner/CTA con viewport <360px.

## Breakpoints & container
| Alias Tailwind | Min-width | Note |
| --- | --- | --- |
| `sm` | 640px | Default Tailwind v4 (nessuna override in `tailwind.config.ts`). |
| `md` | 768px | Utilizzato per mostrare la navigazione desktop e aumentare tipografia. |
| `lg` | 1024px | Footer passa a layout a colonne (`lg:grid-cols-12`). |
| `xl` | 1280px | Griglia eventi aggiunge terza colonna (`xl:grid-cols-3`). |
| `2xl` | 1536px | Nessuna classe attiva attualmente. |

**Container custom**: la classe CSS `.container` (`src/styles/utilities.css`) forza `width: min(1100px, 92vw)` con padding orizzontale `var(--space-4)`, utilizzata nel banner cookie.

## Mappa componenti & comportamento responsive
### Header (`src/components/site/Header.tsx`)
- Wrapper `sticky top-0` con `bg-[#004177]` (aggiornato) e bordo inferiore semitrasparente.
- Navigazione desktop `md:flex`; su mobile il bottone hamburger (`md:hidden`) apre un pannello `grid` con `bg-[#004177]`.
- Focus ring e aria-attributes (`aria-expanded`, `aria-controls`) corretti; `focus-visible:ring-offset-[#2596be]` rimasto dal colore precedente → mismatch cromatico.

### Hero (`src/components/site/Hero.tsx`)
- Sezione `flex-col` con overlay gradient su background image dinamica.
- Tipografia scala da `text-5xl` a `text-6xl` su `md`, paragrafo `md:text-xl`; CTA raggruppate `flex-wrap` per evitare overflow.
- Contrasto elevato (`text-slate-100` su overlay scuro); CTA primarie con `focus-visible:outline` ambra.

### Lista eventi (`src/app/(site)/page.tsx`)
- Griglia `grid gap-6` che passa da colonna singola → `sm:grid-cols-2` → `xl:grid-cols-3`.
- Card `flex h-full flex-col` con header tipografico e footer testuale; layout mantiene altezza uniforme.
- Messaggio fallback (nessun evento) utilizza `px-6 py-8` e `md:text-lg`.

### Newsletter form (`src/components/newsletter/NewsletterForm.tsx`)
- Form `grid gap-3` con `flex-col` → `sm:flex-row`; input e bottone min-height `min-h-11` (≥44px) per tap target.
- Validazione base email, `aria-invalid` + messaggio errore `role="alert"`.

### Footer (`src/components/site/Footer.tsx`)
- Layout `grid gap-12` con sezioni allocate su `lg:col-span-4`; su mobile impila contatti, link, newsletter.
- Newsletter integrata con `max-w-xl`; sezione mappa `DeferredMap` segue con flex baseline.
- Ribbon finale in `<img>` full width con wrapper `bg-[#004177]`.

### Cookie banner & modale (`src/components/cookies/*`)
- `CookieBar` fixed bottom con `.container` 92vw; bottoni `.btn` (CSS globale) in flex-wrap.
- `PreferencesModal` overlay `fixed inset-0` con dialog `width: min(680px, 92vw)` e `FocusTrap`, ma nessun lock su scroll body.
- `DeferredMap` mostra placeholder e CTA per abilitare cookie funzionali, con `grid gap-4` responsive.

## Issue tracker
| Componente | Breakpoint | Sintomo | Causa probabile | Fix proposto (classi/markup) | Impatto | Priorità |
| --- | --- | --- | --- | --- | --- | --- |
| Header | Tutti (focus) | Il ring offset resta azzurro (`#2596be`) e stacca sul nuovo blu `#004177`, percepito come alone incoerente su focus tastiera. | Classi `focus-visible:ring-offset-[#2596be]` non aggiornate dopo il cambio colore. | Aggiornare le classi a `focus-visible:ring-offset-[#004177]` su link/logo/bottone. | Basso (estetica/accessibilità visiva) | Media |
| CookieBar | ≤375px / dispositivi con notch | Banner fisso aderisce al bordo senza considerare `safe-area`, rischia sovrapporsi a gesture bar iOS. | Inline style privo di padding extra su `env(safe-area-inset-bottom)`. | Aggiungere `paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))'` e `paddingInline` analogo. | Medio (tap CTA lower viewport) | Alta |
| PreferencesModal | ≤768px | Con dialog aperto si può scrollare la pagina sottostante, con rischio di perdere il bottone chiudi fuori viewport. | Overlay non blocca scroll/overflow del body. | Alla mount applicare `document.body.style.overflow='hidden'` (ripristino on cleanup) oppure aggiungere wrapper `className="fixed inset-0 overflow-y-auto"`. | Medio (UX) | Media |

## Checklist QA mobile (320px – 768px)
- [ ] `<meta name="viewport">` verificato via sorgente Next.js default.
- [ ] Nessun CLS critico: hero e card eventi hanno height deterministiche.
- [ ] Tap target ≥44px: CTA hero, bottoni newsletter, cookie banner hanno `min-h-11` / padding sufficiente.
- [ ] `:focus-visible` visibili su link/menu; controllare offset colore dopo fix suggerito.
- [ ] `aria-current` sui link nav gestito da `computeAriaCurrent` (`Header.tsx`).
- [ ] Contrasto AA: testo bianco su overlay scuro, amber CTA su sfondo blu (verificare ratio >4.5:1).
- [ ] Hamburger menu: `aria-expanded` toggla correttamente, nav mobile `grid` scorre senza overflow.
- [ ] Scroll lock modale cookie: da verificare dopo implementazione fix (attualmente mancante).
- [ ] Banner cookie non copre CTA principali (Hero) dopo aggiunta safe-area.
- [ ] CTA `Prenota ora` + `Guarda gli eventi` accessibili via tastiera e non coperte da overlay.

## Appendice — snippet rilevanti
- Header con menu mobile: [`src/components/site/Header.tsx`](../src/components/site/Header.tsx)
- Hero overlay e CTA: [`src/components/site/Hero.tsx`](../src/components/site/Hero.tsx)
- Griglia eventi landing: [`src/app/(site)/page.tsx`](../src/app/(site)/page.tsx)
- Newsletter form: [`src/components/newsletter/NewsletterForm.tsx`](../src/components/newsletter/NewsletterForm.tsx)
- Cookie banner & modale: [`src/components/cookies/CookieBar.tsx`](../src/components/cookies/CookieBar.tsx), [`PreferencesModal.tsx`](../src/components/cookies/PreferencesModal.tsx)
- Deferred map e gestione consensi: [`src/components/map/DeferredMap.tsx`](../src/components/map/DeferredMap.tsx)
