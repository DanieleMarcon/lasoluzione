# Audit Catalogo / Carrello – fase 1

## Executive summary
- Modelli e API per il **Catalogo unificato** sono operativi: `Product`, `CatalogSection`, pivot `SectionProduct` e primo endpoint pubblico `/api/catalog`.
- Area admin aggiornata con **/admin/catalog/products** (CRUD prodotto con flag nutrizionali) e **/admin/catalog/sections** (toggle sezione + assegnazioni). I toast segnalano ogni azione.
- Migrazione convivente: wizard prenotazioni legacy resta attivo; nuova infrastruttura catalogo convive senza side effect.

## Fatto
- Aggiornato schema Prisma con entità Catalogo + carrello (`Cart`, `CartItem`, `Order`, `EventInstance` in stand-by).
- API admin: `GET/POST /api/admin/products`, `POST /api/admin/sections`, `POST/DELETE /api/admin/sections/:id/products` con validazioni Zod.
- UI admin con ToastProvider condiviso; enableDateTime limitato a **pranzo** e **cena**.
- Endpoint pubblico `GET /api/catalog` restituisce sezioni attive con prodotti assegnati e flag nutrizionali.

## Da fare (allineato al README)
- REST carrello: `POST /api/cart`, `POST /api/cart/items`, gestione quantità e sessioni.
- Checkout: `POST /api/orders` (pagamento o auto-conferma se totale = 0 €) e mail automatiche.
- UI pubblica catalogo con carrello persistente e bridge provvisorio verso il wizard legacy.
- Mail operative da `Order`/`CartItem` e mapping inverso verso gli oggetti legacy.

## Verifiche manuali suggerite
1. `pnpm dev` e seed completati.  
   ```bash
   curl -s http://localhost:3000/api/catalog | jq '.sections[0]'
   ```
2. Admin → Catalogo → Prodotti: creare prodotto test (slug auto).  
   Verificare toast verde e presenza in tabella.
3. Admin → Catalogo → Sezioni:  
   - Toggle stato sezione e confermare toast.  
   - Per chiavi `pranzo`/`cena`, testare toggle **Abilita/Disabilita data/ora** (disabilitato altrove).  
   - Assegnare un prodotto via ricerca; salvare ordine/featured/home e confermare aggiornamento in tabella.
4. Eliminare assegnazione: bottone “Rimuovi” → conferma → toast rosso.

## Note tecniche
- `enableDateTime` è editabile **solo** per le sezioni con `key` `pranzo` o `cena`; la UI disabilita l’azione per le altre chiavi.
- Toast: usare `useToast()` esclusivamente sotto `<ToastProvider>` (`src/components/admin/ui/toast.tsx`).
- `GET /api/catalog` ignora prodotti inattivi e ordina per `displayOrder` sezione + `order` link.
- Le chiamate admin usano `fetch` senza cache (`cache: 'no-store'`) per evitare stale data durante le sessioni.
