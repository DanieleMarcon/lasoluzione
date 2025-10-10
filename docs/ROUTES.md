# Routing

## Pagine App Router
| Path | File | Descrizione | Auth | Note |
| --- | --- | --- | --- | --- |
| `/` | `src/app/(site)/page.tsx` | Landing marketing con CTA prenotazione, sezione eventi, newsletter, mappa deferita | Pubblica | Layout dedicato `(site)/layout.tsx` con banner cookie |
| `/prenota` | `src/app/prenota/page.tsx` | Wizard legacy oppure catalogo+carrello in base a `NEXT_PUBLIC_CART_ENABLED` | Pubblica | Importa `BookingWizard`, `SectionAccordion`, `CartSidebar` |
| `/checkout` | `src/app/checkout/page.tsx` | Form checkout (email, recap carrello, consensi) + gestione stati verify/pagamento | Pubblica | Usa `useCart`, sessionStorage `order_verify_token`, redirect in base alla risposta API |
| `/checkout/email-sent` | `src/app/checkout/email-sent/page.tsx` | Conferma invio email, consente resend via `/api/bookings/resend-confirmation` | Pubblica | Gestisce stato UI e messaggi localizzati |
| `/checkout/confirm` | `src/app/checkout/confirm/page.tsx` | Consumazione token legacy (GET `/api/bookings/confirm`) | Pubblica | Supporta stati `success`, `expired`, `already_used`, `invalid` |
| `/checkout/return` | `src/app/checkout/return/page.tsx` | Poll `/api/payments/order-status` dopo redirect provider | Pubblica | Reindirizza a `/checkout/success` su esito `paid/completed` |
| `/checkout/cancel` | `src/app/checkout/cancel/page.tsx` | Messaggio di annullamento pagamento | Pubblica | Link rapido per tornare al carrello |
| `/checkout/success` | `src/app/checkout/success/page.tsx` | Messaggio conferma + ID ordine/booking | Pubblica | Chiama `useCart().clearCartToken()` |
| `/privacy` | `src/app/privacy/page.tsx` | Testo informativa privacy | Pubblica | |
| `/cookie-policy` | `src/app/cookie-policy/page.tsx` | Informativa cookie con versione da `NEXT_PUBLIC_POLICY_VERSION` | Pubblica | |
| `/fake-payment` | `src/app/fake-payment/page.tsx` | Simulatore pagamento (POST `/api/bookings/fake-confirm|fake-cancel`) | Pubblica | Usa query `token` |
| `/eventi/[slug]` | `src/app/eventi/[slug]/page.tsx` | Dettaglio evento + form prenotazione email-only | Pubblica | Richiede `DATABASE_URL`; fallback messaggio se assente |
| `/admin` | `src/app/admin/page.tsx` | Dashboard prenotazioni (statistiche + tabelle) | Admin | Protezione middleware + NextAuth |
| `/admin/signin` | `src/app/admin/signin/page.tsx` | Login magic link | Pubblica | Provider email NextAuth |
| `/admin/not-authorized` | `src/app/admin/not-authorized/page.tsx` | Messaggio whitelist fallita | Pubblica | |
| `/admin/bookings` | `src/app/admin/bookings/page.tsx` | Lista prenotazioni avanzata | Admin | Query Prisma server-side |
| `/admin/bookings/print` | `src/app/admin/bookings/print/page.tsx` | Layout stampa prenotazioni | Admin | |
| `/admin/catalog/products` | `src/app/admin/catalog/products/page.tsx` | CRUD prodotti (lista, form modale) | Admin | Usa client component per gestione toast |
| `/admin/catalog/sections` | `src/app/admin/catalog/sections/page.tsx` | Gestione sezioni e assegnazioni prodotto | Admin | Client component `SectionsPageClient` |
| `/admin/contacts` | `src/app/admin/contacts/page.tsx` | Gestione contatti lead | Admin | |
| `/admin/contacts/print` | `src/app/admin/contacts/print/page.tsx` | Stampa lead | Admin | |
| `/admin/events` | `src/app/admin/events/page.tsx` | Lista eventi calendario | Admin | |
| `/admin/events/[id]` | `src/app/admin/events/[id]/page.tsx` | Dettaglio evento | Admin | |
| `/admin/menu/dishes` | `src/app/admin/menu/dishes/page.tsx` | CRUD menu legacy | Admin | |
| `/admin/settings` | `src/app/admin/settings/page.tsx` | Config prenotazioni legacy | Admin | |
| `/admin/tiers` | `src/app/admin/tiers/page.tsx` | Gestione pacchetti legacy | Admin | |

## API
| Metodo | Path | Request (body/query) | Response principale | Errori noti |
| --- | --- | --- | --- | --- |
| GET | `/api/cart` | Query `token` (opzionale) | `{ ok: true, data: CartDTO }` + cookie `cart_token` | `404 cart_not_found` se token invalido |
| POST | `/api/cart` | `{ token?: string }` | Crea/riapre carrello, restituisce DTO | `500` su errore DB |
| GET | `/api/cart/:id` | Param `id` | `{ ok: true, data: CartDTO }` | `404 cart_not_found` |
| PATCH | `/api/cart/:id` | Param `id` | Ricalcola totale, restituisce DTO | `404 cart_not_found` |
| POST | `/api/cart/:id/items` | `{ productId, qty?, nameSnapshot?, priceCentsSnapshot?, meta? }` | `{ ok: true, data: CartItem }` | `400 validation_error`, `404 cart_not_found` |
| DELETE | `/api/cart/:id/items?productId=` | Query `productId` | `{ ok: true, data: null }` | `400 invalid_product` |
| POST | `/api/orders` | `{ cartId, email, name, phone, notes? }` | `{ ok: true, data: { orderId, status, … } }` | `400 invalid_payload`, `404 cart_not_found`, `400 cart_empty` |
| POST | `/api/orders/finalize` | `{ orderId }` | `{ ok: true, orderId }` | `400 missing_order`, `500 finalize_failed` |
| POST | `/api/payments/checkout` | Checkout payload (cliente, consensi, items dal carrello, `verifyToken?`) | Stati: `{ state: 'verify_sent' | 'confirmed' | 'paid_redirect', ... }` | `400 cart_not_found/cart_empty`, `500 verify_email_failed`, `500 server_error` |
| GET | `/api/payments/email-verify?token=` | Query `token` | Redirect `302` verso `/checkout?verified=1` o `/checkout/success` (email-only) + cookie `order_verify_token` | `400 Token non valido o scaduto` |
| GET/POST | `/api/payments/order-status` | Query `orderId` o `ref` | `{ ok: true, data: { status, orderId } }` | `404 order_not_found`, `500 status_error` |
| POST | `/api/bookings` | Payload wizard legacy (tipo, data, persone, menu) | `{ ok: true, bookingId }` | `400 Dati non validi`, `409 requiresPrepay`, `409 tier_unavailable` |
| POST | `/api/bookings/email-only` | `{ eventSlug|eventInstanceId, customer{name,email,phone}, people, notes?, agreePrivacy, agreeMarketing }` | `{ ok: true, bookingId, verificationToken }` | `400 event_slug_not_found`, `400 email_only_not_allowed`, `400 invalid_people`, `500 verify_email_failed` |
| GET | `/api/bookings/confirm?token=` | Query `token` | `{ ok: true, state: 'confirmed' }` | `{ ok: false, state: 'expired'|'used'|'invalid' }` |
| POST | `/api/bookings/resend-confirmation` | `{ bookingId }` | `{ ok: true }` | `400 invalid_payload`, `404 booking_not_found`, `429 rate_limited` |
| POST | `/api/bookings/fake-confirm` | `{ token }` | `{ ok: true, bookingId }` | `400 invalid_token` |
| POST | `/api/bookings/fake-cancel` | `{ token }` | `{ ok: true }` | `400 invalid_token` |
| POST | `/api/bookings/prepay` | Payload legacy | `{ ok: true, paymentUrl }` | Errori legacy (`requires_revolut_config`, ecc.) |
| GET | `/api/booking-config` | — | Booking config DTO (menu, settings, tiers) | `200` fallback default su errore |
| GET | `/api/catalog` | Query `section?` (facoltativa) | `{ sections: [...], products: [...] }` | `200` con array vuoti se nulla attivo |
| GET | `/api/events` | — | `{ events: [...] }` | `200` con lista vuota |
| POST | `/api/newsletter` | `{ email }` | `{ ok: true }` | `400 invalid_email`, `409 already_confirmed` |
| GET/POST | `/api/admin/*` | Vari payload JSON | Tipicamente `{ ok: true, data }` | `401`/`403` se non autenticato o email non in whitelist |
| GET/POST | `/api/auth/[...nextauth]` | Gestito da Auth.js | Magic link email | Errori standard NextAuth |

### Convenzioni risposta
- Tutte le API REST restituiscono JSON con chiave `ok` booleana quando non usano NextAuth/redirect.
- Errori noti vengono serializzati come `{ ok: false, error: 'code' }`; in caso di validazione Zod è presente `details` con `flatten()`.
- Endpoint checkout/email impostano cookie `order_verify_token` (httpOnly, `lax`) quando l’email viene verificata.
