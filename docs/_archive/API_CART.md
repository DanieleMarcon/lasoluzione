# API Catalogo / Carrello

## Pubblico

### `GET /api/catalog`
- **Metodo**: `GET`
- **Cache**: `force-dynamic` (nessuna cache Next).
- **Risposta**: `{ sections: SectionDTO[] }` con sole sezioni `active = true`.
- **SectionDTO**: `{ id, key, title, description?, enableDateTime, displayOrder, products: ProductDTO[] }`.
- **ProductDTO**: `{ id, slug, name, priceCents, imageUrl?, tags, nutritionFlags, order }`; solo prodotti `active = true`.
- **Ordinamento**: sezioni per `displayOrder`, prodotti per `order` pivot (fallback nome).

Esempio minimo:
```bash
curl -s http://localhost:3000/api/catalog | jq '.sections | length'
```

## Admin (richiede sessione magic-link)

### `GET /api/admin/products`
- Querystring supportate: `page`, `pageSize`, `q`, `category`, `active` (`true|false|all`).
- Risposta: `{ ok: true, data: Product[], meta: { page, pageSize, total, totalPages } }`.
- Filtra automaticamente sui prodotti con `tenantId` attuale (quando applicabile).

Esempio minimo (cookie sessione valido):
```bash
curl -s --cookie "next-auth.session-token=..." \
  "http://localhost:3000/api/admin/products?page=1&pageSize=5"
```

### `POST /api/admin/products`
- Body JSON: `name`, `slug?`, `description?`, `ingredients?`, `allergens?`, `priceCents`, `unitCostCents?`, `supplierName?`, `stockQty?`, `imageUrl?`, `category?`, `order?`, `active?`, flag nutrizionali (`isVegan`, `isVegetarian`, `containsAlcohol`, ecc.).
- Valida con Zod; slug auto-generato se omesso. Errori possibili: `validation_error` (422), `slug_conflict` (409).

### `POST /api/admin/sections`
- Body: `{ key, title, description?, active?, enableDateTime?, displayOrder? }`.
- Comportamento: upsert su `key`; `enableDateTime` applicato **solo** quando `key` ∈ {`pranzo`, `cena`}.

### `POST /api/admin/sections/:id/products`
- Body: `{ productId, order?, featured?, showInHome? }`.
- Effetto: crea o aggiorna record pivot `SectionProduct` mantenendo ordering.

### `DELETE /api/admin/sections/:id/products`
- Richiede `productId` (querystring o body) e rimuove il collegamento sezione↔prodotto.

## TODO (fase 2+)
- `/api/cart` + `/api/cart/items`: creare carrello, mutare quantità, persistenza sessione.
- `/api/orders`: checkout con pagamento o auto-conferma per totale 0 €, generazione email.
