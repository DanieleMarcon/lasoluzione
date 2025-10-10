# Database

## Schema Prisma (estratto)
```
Booking              ─┬─< BookingVerification
                      └─? Order
Order ────1:1── Cart ─┬─< CartItem
                      └─< Booking
Product ──< SectionProduct >── CatalogSection
Product ──< EventInstance
EventTier (legacy) → Product (seed bridge)
User/Account/Session/VerificationToken (Auth.js)
```

### Modelli principali
- **Cart / CartItem**: carrello persistito (token = `id`). `Cart.status` (`open`, `locked`, ecc.) e `totalCents` aggiornati da `recalcCartTotal`.
- **Order**: 1:1 con `Cart` (`cartId @unique`). Contiene stato pagamento (`pending`, `pending_payment`, `paid`, `confirmed`), `paymentRef` (JSON `RevolutPaymentMeta`) e collegamento a `Booking`.
- **Booking**: rappresenta prenotazioni legacy e derivate dal checkout. Campi extra (`lunchItemsJson`, `tierLabel`, `tierPriceCents`) conservano snapshot dell’ordine. Relazione opzionale con `Order`.
- **BookingVerification**: token email-only (64 hex) con `expiresAt`, `usedAt`, `@@index(expiresAt)`.
- **Product / CatalogSection / SectionProduct**: dominio catalogo/cart. `SectionProduct` usa chiave composta `sectionId_productId`.
- **EventInstance**: eventi programmati collegati a `Product`, campo `allowEmailOnlyBooking` guida il flow email-only.
- **MenuDish / EventTier**: modelli legacy usati dal seed per popolare `Product`.
- **Auth.js**: `User`, `Account`, `Session`, `VerificationToken` gestiti dal provider email.

## Relazioni chiave
- `Order.cartId` è `@unique` → impedisce ordini duplicati per lo stesso carrello.
- `Booking.orderId` collega booking a ordine (nullable per legacy). Cascade su `CartItem` e `BookingVerification`.
- `EventInstance.productId` collega evento a prodotto per sfruttare snapshot prezzo/descrizione.

## Seed & reset
- Seed non distruttivo: `pnpm tsx prisma/seed.ts` (aggiorna/crea sezioni, replica MenuDish in Product, genera prodotti per EventTier).
- Reset database (⚠️ cancella dati):
  ```bash
  pnpm prisma migrate reset --force
  pnpm tsx prisma/seed.ts
  ```
- Per azzerare manualmente il file SQLite elimina `prisma/dev.db`, `dev.db-journal`, `dev.db-shm`, quindi `pnpm prisma db push`.

## Indici e vincoli rilevanti
- `BookingVerification.token` `@unique` + indici su `bookingId` e `expiresAt` (cleanup rapido).
- `Order.cartId` `@unique`, indici su `(cartId, status)` e `paymentRef` per poll stato.
- `CartItem` indicizzato per `cartId` e `productId` (lookup rapido in API).
- `SectionProduct` `@@id([sectionId, productId])` evita duplicati; indice su `(sectionId, order)` per sort.
- `EventInstance.slug` `@unique` per pagine dinamiche.
- `User.email` `@unique` (Auth.js) con cascade su `Account`/`Session`.

## Note operative
- Checkout/email-only cancellano token usati tramite `bookingVerification.deleteMany` per prevenire reuse.
- Prisma client è singleton (`src/lib/prisma.ts`) con log verbose solo in sviluppo.
- In ambiente dev SQLite gira in modalità default; per usare WAL setta `?connection_limit=1&log=...` in `DATABASE_URL` se necessario.
