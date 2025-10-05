# Stato snapshot – ottobre 2025

## Prisma / Migrazioni principali
- `20251001150916_init` → modelli `Booking`, `MenuDish`, auth base.
- `20251002071639_add_type_and_flags` → tipi prenotazione, flag privacy/marketing.
- `20251002133537_booking_settings` → tabella `BookingSettings`.
- `20251002160000_admin_auth` & `20251003051448_admin_auth` → compatibilità Auth.js (`User`, `Account`, `Session`).
- `20251004120000_lunch_menu` → gestione piatti pranzo con ordering.
- `20251004145500_dinner_prepay_and_visible_at` + `20251004193000_add_cena_booking_type` → percorso cena nel wizard legacy.
- `20251005_cart_schema` → nuova area Catalogo/Carrello (`Product`, `CatalogSection`, `SectionProduct`, `EventInstance`, `Cart`, `CartItem`, `Order`).

## Modelli attuali
- **Legacy prenotazioni**: `Booking`, `BookingSettings`, `MenuDish`, `EventTier`, `VerificationToken` & stack Auth.js.
- **Catalogo unificato**: `Product` (flag nutrizionali, stock, supplier), `CatalogSection` (toggle `active`, `enableDateTime`), `SectionProduct` pivot (`order`, `featured`, `showInHome`).
- **Carrello/ordini** (schema pronto, UI da costruire): `EventInstance`, `Cart`, `CartItem`, `Order`.

## Pagine admin
- Legacy: `/admin`, `/admin/bookings`, `/admin/menu/dishes`, `/admin/tiers`, `/admin/settings`.
- Nuove (fase 1): `/admin/catalog/products` (CRUD prodotto) e `/admin/catalog/sections` (toggle sezione + assegnazioni con toast). `enableDateTime` editabile solo per `pranzo` e `cena`.

## Endpoint pubblici
- Legacy: `GET /api/booking-config`, `POST /api/bookings`, `POST /api/bookings/prepay`.
- Nuovo: `GET /api/catalog` (sezioni attive con prodotti assegnati).

## Endpoint admin
- Legacy: `GET/POST /api/admin/menu/dishes`, `GET/POST /api/admin/tiers`, `GET/PUT/PATCH /api/admin/settings`, bookings CRUD.
- Nuovi: `GET/POST /api/admin/products`, `POST /api/admin/sections`, `POST/DELETE /api/admin/sections/:id/products`.

## Note operative
- Wizard legacy resta sorgente ordini finché il checkout non è migrato.
- Nuovo schema non yet esposto al pubblico: carrello e ordini saranno coperti da fase 2 (`/api/cart`, `/api/orders`).
- Toast provider centralizzato in `src/components/admin/ui/toast.tsx`, usato da prodotti e sezioni.
