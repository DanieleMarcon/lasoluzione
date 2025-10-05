# Audit Catalogo / Carrello – fase 1

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
