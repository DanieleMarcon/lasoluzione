# Stato snapshot – ottobre 2025

## Migrazioni principali
- `20251001150916_init` – base booking/auth.
- `20251002071639_add_type_and_flags` – tipologie prenotazione + flag consenso.
- `20251002133537_booking_settings` – configurazioni booking.
- `20251002160000_admin_auth` + `20251003051448_admin_auth` – upgrade Auth.js (`User`, `Account`, `Session`).
- `20251004120000_lunch_menu` – ordering piatti pranzo.
- `20251004145500_dinner_prepay_and_visible_at` + `20251004193000_add_cena_booking_type` + `20251004180020_add_eventtier_timestamps` – percorso cena legacy completo.
- `20251005_cart_schema` – introduzione Catalogo/Carrello (`Product`, `CatalogSection`, `SectionProduct`, `EventInstance`, `Cart`, `CartItem`, `Order`).

## Modelli attivi
- **Legacy prenotazioni**: `Booking`, `BookingSettings`, `MenuDish`, `EventTier`, `VerificationToken`, stack Auth.js.
- **Catalogo unificato**: `Product` (flag nutrizionali, prezzi, stock), `CatalogSection` (`active`, `enableDateTime`, `displayOrder`), `SectionProduct` (`order`, `featured`, `showInHome`).
- **Carrello / Ordini**: `EventInstance`, `Cart`, `CartItem`, `Order` (schema pronto, logica in roadmap).

## Pagine admin
- **Legacy**: `/admin`, `/admin/bookings`, `/admin/menu/dishes`, `/admin/tiers`, `/admin/settings`.
- **Nuove (catalogo)**: `/admin/catalog/products` (CRUD prodotto, flag nutrizionali, slug auto) e `/admin/catalog/sections` (toggle sezione, `enableDateTime` solo per `pranzo`/`cena`, gestione featured/home con toast provider condiviso).

## Endpoint pubblici
- **Legacy**: `GET /api/booking-config`, `POST /api/bookings`, `POST /api/bookings/prepay`.
- **Nuovo**: `GET /api/catalog` (sezioni attive con prodotti assegnati).

## Endpoint admin
- **Legacy**: `GET/POST /api/admin/menu/dishes`, `GET/POST /api/admin/tiers`, `GET/PUT/PATCH /api/admin/settings`, CRUD prenotazioni.
- **Nuovi**: `GET/POST /api/admin/products`, `POST /api/admin/sections`, `POST/DELETE /api/admin/sections/:id/products`.

## Note operative
- Wizard prenotazioni legacy rimane percorso ufficiale ordini finché `/api/orders` non sarà attivo.
- Nuove API cart/ordini sono pianificate (fase 2) e non esposte.
- Toast provider centralizzato (`src/components/admin/ui/toast.tsx`) condiviso da prodotti e sezioni.
