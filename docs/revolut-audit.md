# Revolut Merchant Sandbox Audit

## Checklist
- ✅ **API version & auth headers** — `revolutFetch` centralizes calls to `https://sandbox-merchant.revolut.com` and attaches both `Authorization: Bearer …` and `Revolut-Api-Version: ${REVOLUT_API_VERSION}` for every request, ensuring downstream helpers inherit the headers when creating or retrieving orders.【F:src/lib/revolut.ts†L21-L45】【F:src/app/api/payments/checkout/route.ts†L32-L55】【F:src/app/api/payments/order-status/route.ts†L34-L45】
- ❌ **Create Order response uses deprecated `public_id`** — the adapter still reads `resp.public_id` and exposes it as `publicId`; new API versions return `token`, so this will break the widget handoff once the field is removed.【F:src/lib/revolut.ts†L13-L75】
- ❌ **Widget initialization still relies on legacy script + public key** — the client loader injects `https://merchant.revolut.com/checkout.js`, expects `window.RevolutCheckout(PUBLIC_KEY)` and requires `NEXT_PUBLIC_REVOLUT_PUBLIC_KEY`, instead of importing `@revolut/checkout` and instantiating with the order token in sandbox mode.【F:src/components/cart/CheckoutButton.tsx†L11-L85】
- ❌ **Payment popup flow** — UI calls `widget.pay(publicId)` and depends on `success_url`/`cancel_url` redirects from the order body, rather than `instance.payWithPopup({ onSuccess, onError, onCancel })` followed by an explicit `router.push('/checkout/return?orderId=…')`. Server still populates `success_url` and `cancel_url`, reinforcing the legacy pattern.【F:src/components/cart/CheckoutButton.tsx†L39-L58】【F:src/lib/revolut.ts†L59-L63】
- ❌ **Order state mapping** — `isRevolutPaid` accepts `approved`, `completed`, `paid`, `settled` but ignores nuanced states: `authorised` should only be treated as paid after capture (automatic capture transitions to `completed`), while `pending`/`processing` should remain pending and `declined` must surface as failure. Current logic could mark pre-capture authorisations as paid and never classifies `declined`.【F:src/lib/revolut.ts†L84-L86】【F:src/app/api/payments/order-status/route.ts†L34-L45】
- ✅ **Capture mode** — Orders are created with `capture_mode: 'automatic'`, matching the MVP assumption and ensuring `completed` follows authorisation without manual capture work.【F:src/lib/revolut.ts†L50-L63】
- ❌ **Environment variables** — `.env.example` still documents `NEXT_PUBLIC_REVOLUT_PUBLIC_KEY`, which is unnecessary for the token-based widget. Only `REVOLUT_SECRET_KEY`, `REVOLUT_API_VERSION`, `REVOLUT_API_BASE`, and return URLs should remain once the widget migration happens.【F:.env.example†L17-L25】【F:src/components/cart/CheckoutButton.tsx†L11-L58】
- ✅ **Return/Cancel behaviour** — `/checkout/return` queries `/api/payments/order-status`, which retrieves the order via the Merchant API and decides the final state server-side, avoiding client-side polling of payments lists.【F:src/app/checkout/return/page.tsx†L7-L78】【F:src/app/api/payments/order-status/route.ts†L34-L45】
- ❌ **Error surfacing** — low-level fetch errors include status + endpoint, but API routes squash the message into generic "Checkout error" / "Status error", and the client shows a non-actionable alert. This hides useful failure details for support & retry UX.【F:src/lib/revolut.ts†L33-L45】【F:src/app/api/payments/checkout/route.ts†L7-L59】【F:src/app/api/payments/order-status/route.ts†L7-L49】【F:src/components/cart/CheckoutButton.tsx†L58-L61】

## Key Findings
1. **Upgrade to token-based checkout SDK** — The deprecated public key flow blocks adoption of `@revolut/checkout` and the newer order token response. Migration requires swapping the script loader with an ESM import, handling async instantiation, and wiring sandbox mode.
2. **Adjust order status evaluation** — Align server-side status mapping with Revolut's latest schema (paid: `completed`; pending: `pending`/`processing`; failure: `failed`, `cancelled`, `declined`; `authorised` gated by capture mode).
3. **Expose actionable errors** — Bubble Revolut API errors (status + message) through the API routes and present user-friendly guidance on retry/alternate payment.

## Fix Plan
1. **SDK & token adoption**
   1. Update `RevolutOrderResponse` to map the new `token` field, propagate through `createRevolutOrder`, and rename downstream props (e.g. `checkoutToken`).【F:src/lib/revolut.ts†L13-L75】
   2. Replace the legacy script loader in `CheckoutButton` with `import RevolutCheckout from '@revolut/checkout';` and instantiate via `await RevolutCheckout(token, 'sandbox')`, storing the instance for popup flows.【F:src/components/cart/CheckoutButton.tsx†L39-L85】
   3. Drop `NEXT_PUBLIC_REVOLUT_PUBLIC_KEY` usage and scrub it from env templates/docs; keep only secret + base + version variables.【F:.env.example†L17-L25】
2. **Popup flow & navigation**
   1. Swap `widget.pay(publicId)` for `instance.payWithPopup({ onSuccess, onError, onCancel })` and redirect to `/checkout/return?orderId=…` within the success callback, avoiding reliance on `success_url`/`cancel_url` order fields.【F:src/components/cart/CheckoutButton.tsx†L39-L58】【F:src/lib/revolut.ts†L59-L63】
   2. Remove `success_url`/`cancel_url` from the create-order payload once the client handles navigation, or keep them only for webhook/backstop flows.【F:src/lib/revolut.ts†L59-L63】
3. **Order status hardening**
   1. Rewrite `isRevolutPaid` to recognise `completed` as paid, treat `authorised` as pending unless capture mode is automatic and state transitions to `completed`, and classify `failed`, `cancelled`, `declined` as failures.【F:src/lib/revolut.ts†L84-L86】
   2. Extend `/api/payments/order-status` to surface declined/cancelled results and optionally return `pending_reason` for UI messaging.【F:src/app/api/payments/order-status/route.ts†L34-L45】
4. **Error handling UX**
   1. Let API routes include Revolut error summaries (e.g. `return NextResponse.json({ ok: false, error: message })`) so the client can display guidance rather than a generic alert.【F:src/app/api/payments/checkout/route.ts†L56-L59】【F:src/app/api/payments/order-status/route.ts†L46-L49】
   2. Replace `alert(...)` with an inline toast/banner and encourage retry or alternate contact when payments fail.【F:src/components/cart/CheckoutButton.tsx†L58-L61】

## Reference Documentation
- Revolut Merchant API versioning and headers — ensure `Revolut-Api-Version` matches the targeted release (e.g. `2024-09-01`).
- Create Order response returning `token` (public identifier) — `public_id` is deprecated.
- `@revolut/checkout` SDK token-based initialisation in `sandbox` or `prod` mode.
- `payWithPopup` success/error/cancel callbacks for handling redirects.
- Order state lifecycle (`pending`, `processing`, `authorised`, `completed`, `failed`, `cancelled`, `declined`) and capture mode implications.
