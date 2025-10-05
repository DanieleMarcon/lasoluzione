# API Catalogo / Carrello

## Pubblico

### `GET /api/catalog`
- **Cache**: `dynamic = force-dynamic` (nessuna cache Next).  
- **Payload**: restituisce un oggetto `{ sections: SectionDTO[] }`.
- `SectionDTO`: `{ key, title, description?, enableDateTime, active, displayOrder, products: ProductDTO[] }`.
- `ProductDTO`: include `id`, `slug`, `name`, `priceCents`, `imageUrl?`, categorie/flag nutrizionali e `order` (ordine nella sezione).
- Regole: solo sezioni `active = true` e prodotti `active = true`; prodotti ordinati per `order` pivot e nome.

Esempio:
```bash
curl -s http://localhost:3000/api/catalog | jq '.sections[0]'
```

## Admin (autenticazione magic-link)

### `GET /api/admin/products`
Querystring: `page`, `pageSize`, `q`, `category`, `active` (`true|false|all`).  
Risposta: `{ ok, data: Product[], meta: { page, pageSize, total, totalPages } }`.

### `POST /api/admin/products`
Body JSON (campi principali): `name`, `slug?`, `description?`, `ingredients?`, `allergens?`, `priceCents`, `unitCostCents?`, `supplierName?`, `stockQty?`, `imageUrl?`, `category?`, `order?`, `active?`, flag nutrizionali.
- Slug auto-generato se vuoto; controlli `slug_conflict` (409) e validazioni Zod (`validation_error`).

Richiesta esempio (GET con sessione attiva e cookies di NextAuth):
```bash
curl -s --cookie "next-auth.session-token=..." \
  "http://localhost:3000/api/admin/products?page=1&pageSize=10"
```

### `POST /api/admin/sections`
Body: `{ key, title, active?, enableDateTime?, displayOrder? }`. Upsert by `key`.  
Note: `enableDateTime` effettivo solo per sezioni `pranzo` e `cena` (UI e API rispettano la regola).

### `POST /api/admin/sections/:id/products`
Body: `{ productId, order?, featured?, showInHome? }` assegnando/aggiornando il link sezione-prodotto.

### `DELETE /api/admin/sections/:id/products`
Richiede `productId` (query o body) e rimuove l’assegnazione.

## TODO (fase 2)
- `/api/cart` + `/api/cart/items` (creazione carrello, mutazioni quantità, persistenza sessione).
- `/api/orders` (checkout, pagamento, email).  
- Endpoint pubblici per tracking carrello/ordini una volta definita la UI.
