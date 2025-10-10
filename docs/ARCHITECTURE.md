# Architettura applicativa

## Diagramma logico
```
[Browser]
   │  (React client components, hook useCart, Zustand consent)
   ▼
Next.js App Router (src/app)
   │  ├─ UI pubblica (landing, prenota, checkout, eventi)
   │  └─ UI admin (dashboard, catalogo, eventi)
   ▼
Server actions & API (src/app/api/*)
   │  ├─ Cart & Orders (/api/cart, /api/orders)
   │  ├─ Checkout/Payments (/api/payments/*)
   │  ├─ Bookings legacy (/api/bookings/*)
   │  ├─ Admin endpoints (/api/admin/*)
   │  └─ Auth.js (/api/auth/[...nextauth])
   ▼
Domain layer (src/lib)
   │  ├─ Prisma client + query helpers (prisma.ts, cart.ts, orders.ts)
   │  ├─ Checkout utilities (paymentRef, revolut, revolutLoader)
   │  ├─ Mailer & templates (mailer.ts, admin/emails.ts)
   │  ├─ Booking verification (bookingVerification.ts)
   │  ├─ Utilities (jwt.ts, logger.ts, date.ts)
   ▼
Prisma ORM → SQLite (prisma/schema.prisma, seed.ts)
   │
   └─ External services: SMTP provider, Revolut Merchant API
```

## Boundary principali
- **Frontend client**: componenti con `"use client"` (checkout page, fake-payment, hook `useCart`) gestiscono stato locale, sessionStorage (`order_verify_token`) e invocano API REST.
- **Frontend server**: layout e pagine server-only (admin dashboard, eventi) eseguono query Prisma direttamente grazie a React Server Components.
- **API/Server actions**: tutta la logica mutativa passa dalle route in `src/app/api/**` (non sono usate server actions esplicite). Ogni endpoint valida input con Zod o controlli manuali e usa helper di `src/lib`.
- **Domain layer**: file in `src/lib/**` incapsulano accesso DB e integrazioni (mailer, Revolut). Evitare di chiamare Prisma direttamente dalle pagine quando esiste un helper dedicato.
- **Background / side effects**: invio email sempre tramite `src/lib/mailer.ts` con fallback log-only se SMTP non configurato; integrazione Revolut centralizzata in `src/lib/revolut.ts`.

## Logging e osservabilità
- `src/lib/logger.ts` espone `logger.info|warn|error` che serializza in JSON e maschera email (`maskEmail`).
- API critiche (`/api/payments/*`, `/api/bookings/email-only`) emettono log strutturati con chiavi `action`, `orderId`, `email`.
- Errori irreversibili vengono anche riportati via `console.error`; in sviluppo Prisma logga query/warn.
- Non esiste tracing centralizzato: per future estensioni si può collegare `logger` a una sink esterna.
