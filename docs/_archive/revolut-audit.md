# Revolut Merchant Sandbox Audit

## Checklist
- ✅ **API version & auth headers** — `revolutFetch` builds `https://sandbox-merchant.revolut.com/api/*` URLs, attaches `Authorization: Bearer …` and `Revolut-Api-Version: 2024-09-01` for every call, and surfaces endpoint/status on failure.【F:src/lib/revolut.ts†L19-L47】
- ✅ **Create Order returns token** — the adapter maps the 2024-09-01 response (`id`, `token`) and exposes `{ paymentRef, token }` to API routes, ensuring the widget receives the order token.【F:src/lib/revolut.ts†L49-L68】
- ✅ **Token-based widget** — CheckoutButton imports `@revolut/checkout`, instantiates `await RevolutCheckout(token, 'sandbox')`, and triggers `payWithPopup` callbacks for success/error/cancel navigation.【F:src/components/cart/CheckoutButton.tsx†L1-L41】
- ✅ **Popup flow navigation** — API no longer sends `success_url`/`cancel_url`; the client redirects explicitly on callback, aligning with popup best practices.【F:src/app/api/payments/checkout/route.ts†L33-L54】【F:src/components/cart/CheckoutButton.tsx†L24-L41】
- ✅ **Order state mapping** — Only `completed` marks local orders as paid, while `failed`/`cancelled`/`declined` become failures and everything else stays pending.【F:src/lib/revolut.ts†L70-L72】【F:src/app/api/payments/order-status/route.ts†L33-L49】
- ✅ **Environment variables** — `.env.example` elenca chiavi pubbliche/segretissime, base URL e redirect necessari per il checkout integrato (`NEXT_PUBLIC_REVOLUT_PUBLIC_KEY`, `NEXT_PUBLIC_REVOLUT_ENV`, `REVOLUT_SECRET_KEY`).【F:.env.example†L1-L14】
- ✅ **Error surfacing** — API routes bubble up Revolut error messages via JSON responses, improving support diagnostics; the client still alerts but logs details for follow-up.【F:src/app/api/payments/checkout/route.ts†L55-L59】【F:src/app/api/payments/order-status/route.ts†L46-L49】【F:src/components/cart/CheckoutButton.tsx†L35-L39】

## Notes
- Capture mode defaults to `automatic`, matching the current fulfilment flow; switch to `'manual'` when adding deferred capture UX.【F:src/lib/revolut.ts†L56-L66】
- `/checkout/return` continues polling `/api/payments/order-status` so the UI reflects `paid`/`failed`/`pending` transitions after popup close.【F:src/app/api/payments/order-status/route.ts†L7-L49】
- Production rollout only requires swapping env values (`REVOLUT_SECRET_KEY`, `REVOLUT_API_BASE=https://merchant.revolut.com`, mode `'prod'`).【F:src/lib/revolut.ts†L19-L25】【F:src/components/cart/CheckoutButton.tsx†L24-L33】
