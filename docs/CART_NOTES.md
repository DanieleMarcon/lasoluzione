---
merged_from:
  - docs/AUDIT_CART.md
  - docs/CART_SCHEMA_NOTES.md
updated: 2025-02-14
---
# Catalogo & Carrello — Stato e Schema

> Questo documento sostituisce `docs/AUDIT_CART.md` e `docs/CART_SCHEMA_NOTES.md`. Contiene la fotografia funzionale e le note di schema per fase 1 del carrello.

## Audit funzionale (fase 1)

## Executive summary
- Catalogo unificato operativo con modelli Prisma dedicati e primo endpoint pubblico `GET /api/catalog`.
- Area admin estesa con `/admin/catalog/products` e `/admin/catalog/sections`, flussi supportati da ToastProvider condiviso.
- Convivenza garantita: wizard prenotazioni legacy resta attivo mentre il nuovo dominio copre solo catalogo e assegnazioni.

## Fatto
- Aggiornato schema Prisma con `Product`, `CatalogSection`, pivot `SectionProduct` e fondazioni carrello (`EventInstance`, `Cart`, `CartItem`, `Order`).
- API admin completate: `GET/POST /api/admin/products`, `POST /api/admin/sections`, `POST/DELETE /api/admin/sections/:id/products` con validazioni Zod e risposte normalizzate.
- UI admin per prodotti e sezioni: ricerca, toggle stato, flag nutrizionali e gestione assegnazioni con toast contestuali.
- `enableDateTime` gestito in API/UI **solo** per le sezioni `pranzo` e `cena`, disabilitato altrove.
- Endpoint pubblico `GET /api/catalog` filtra sezioni/prodotti attivi e restituisce DTO ordinati.

## Da fare (fase 2+ — allineato al README)
- REST carrello: `/api/cart`, `/api/cart/items`.
- Checkout: `/api/orders` (pagamento o auto-conferma se totale = 0 €).
- UI pubblica “accordion” (Eventi, Aperitivo, Colazione, Pranzo, Cena) con carrello persistente.
- Mail da `Order`/`CartItem` (cliente + admin).
- Bridge temporaneo nuovo → DTO legacy per coesistenza col wizard.

## Verifiche manuali suggerite
1. Seed concluso → `pnpm dev`, poi:
   ```bash
   curl -s http://localhost:3000/api/catalog | jq '.sections[0]'
   ```
2. Admin → Catalogo → Prodotti: creare/modificare un prodotto e verificare toast verde + comparsa in tabella.
3. Admin → Catalogo → Sezioni:
   - Attivare/disattivare una sezione e verificare il toast.
   - Per `pranzo`/`cena`, provare il toggle **Abilita data/ora** (disabilitato per altre chiavi).
   - Assegnare un prodotto, impostare featured/home e ordine, confermare persistenza.
4. Rimuovere un’assegnazione (bottone “Rimuovi”) e verificare toast rosso + aggiornamento elenco.

## Note tecniche
- `enableDateTime` è effettivo solo su `pranzo`/`cena`; la UI mostra pulsante disabilitato sugli altri record.
- Toast disponibili tramite `useToast()` dentro `<ToastProvider>` (`src/components/admin/ui/toast.tsx`).
- Le chiamate admin usano `cache: 'no-store'` per evitare dati stantii durante la sessione.
- `GET /api/catalog` ordina per `displayOrder` della sezione e `order` nel legame prodotto.

## Note sullo schema dati

Il nuovo schema introduce un catalogo unificato composto dai modelli `Product`, `CatalogSection` e `SectionProduct`, che consentono di riutilizzare le stesse schede articolo su più sezioni attivabili (eventi, aperitivo, pranzo, cena, colazione) e di conservarne l’origine legacy tramite `sourceType`/`sourceId`. Le istanze datate per eventi futuri saranno gestite da `EventInstance`, mentre il flusso d’acquisto passa da `Cart` e `CartItem` alla conferma in `Order`, con un riferimento opzionale da `Booking` (`orderId`) per la compatibilità con il sistema di prenotazioni esistente.

## Cronologia merge
- Contenuti originali: `docs/AUDIT_CART.md`, `docs/CART_SCHEMA_NOTES.md` (ottobre 2025).
