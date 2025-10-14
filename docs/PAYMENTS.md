---
merged_from:
  - docs/REVOLUT.md
  - docs/revolut-audit.md
updated: 2025-02-14
---
# Pagamenti & Integrazione Revolut

> Questo documento sostituisce: `docs/REVOLUT.md`, `docs/revolut-audit.md`. Consultare l'appendice per la cronologia merge e i riferimenti originali.

## Requisiti e configurazione ambiente

1. Imposta le variabili in `.env.local`:
   - `NEXT_PUBLIC_REVOLUT_ENV=sandbox`
   - `NEXT_PUBLIC_REVOLUT_PUBLIC_KEY=pk_test_...`
   - `REVOLUT_SECRET_KEY=sk_test_...`
   - `REVOLUT_API_VERSION=2024-09-01` (o versione supportata)
   - `REVOLUT_API_BASE` (opzionale, es. `https://sandbox-merchant.revolut.com`)
   - `PAY_RETURN_URL` / `PAY_CANCEL_URL` per i redirect (`/checkout/return|cancel` di default).
2. Genera chiavi e token dal Merchant Dashboard (Developers → API Keys → Checkout public token).
3. Abilita il dominio di test nelle impostazioni Revolut quando usi il widget embedded.
4. Mantieni aggiornato `.env.example` con le stesse chiavi per on-boarding team.

## Flusso applicativo

- `POST /api/payments/checkout` chiama `createRevolutOrder` (`src/lib/revolut.ts`) se `totalCents > 0` e l'email cliente è verificata.
- L'helper costruisce `POST /orders` con `amountMinor`, `merchant_order_data.reference = order.id` e, se presente, l'email cliente.
- Risposta attesa: `{ paymentRef, checkoutPublicId?, hostedPaymentUrl? }`.
  - `hostedPaymentUrl` viene restituito al client e salvato nel `paymentRef` insieme a esito email.
  - Se `NEXT_PUBLIC_REVOLUT_PUBLIC_KEY` manca, si usa l'URL hosted in nuova scheda.
- Il frontend utilizza `loadRevolutSDK()` per inizializzare il widget popup passando `checkoutPublicId` + `publicToken`.

## Callback, polling e stato ordine

- Nessun webhook: lo stato pagamento è interrogato da `/api/payments/order-status`, che invoca `retrieveRevolutOrder` e considera `completed` l'unico esito pagato.
- `/api/orders/finalize` marca l'ordine come pagato e innesca email una volta verificato lo stato.
- `/checkout/return` continua a fare polling finché il pagamento non è `paid`/`failed` o resta `pending`.

## Errori comuni e remediation

| Sintomo | Probabile causa | Fix |
| --- | --- | --- |
| Risposta checkout `{ configWarning: 'NEXT_PUBLIC_REVOLUT_PUBLIC_KEY non configurata' }` | Token pubblico mancante | Imposta `NEXT_PUBLIC_REVOLUT_PUBLIC_KEY` oppure accetta hosted page |
| Errore `Missing REVOLUT_SECRET_KEY` | Secret non impostato o `.env` non caricato | Aggiorna `.env.local` e riavvia dev server |
| Redirect `/checkout/return` bloccato in polling | Ordine Revolut ancora `pending` | Completa pagamento o annulla, valutando webhook per aggiornamenti |
| Risposta `Revolut API 401` nei log | Secret errata o token scaduto | Rigenera la chiave nel merchant portal |
| Hosted page errore dominio | Domini non configurati | Aggiungi dominio in Checkout → Allowed domains |

## Suggerimenti operativi

- In sandbox usa carte test ufficiali (es. `5123 4500 0000 0008`).
- Logga `paymentRef` con `emailError` ed `emailSentAt` per troubleshooting.
- `capture_mode` resta `automatic`; passa a `'manual'` per future UX di incasso differito.
- Per test manuali del widget importa dinamicamente `loadRevolutSDK` in componenti client (`mode: 'sandbox'`).
- Per produzione cambia solo i valori env (`REVOLUT_SECRET_KEY`, `REVOLUT_API_BASE=https://merchant.revolut.com`, `mode: 'prod'`).

## Audit checklist integrazione

- ✅ API version & auth headers centralizzati in `revolutFetch` con logging dello status in caso di failure.
- ✅ Create Order restituisce token mappato in `{ paymentRef, token }` per i consumer API.
- ✅ CheckoutButton usa `RevolutCheckout(token, 'sandbox')` e gestisce `payWithPopup` success/error/cancel.
- ✅ Il popup guida la navigazione client-side; nessun `success_url`/`cancel_url` lato backend.
- ✅ Solo `completed` segna l'ordine come pagato; altri stati vengono propagati come failure o pending.
- ✅ Variabili ambiente documentate in `.env.example`.
- ✅ Errori Revolut sono surfacati nelle API e loggati per supporto.

## Appendice — Cronologia merge

- Documento consolidato da `docs/REVOLUT.md` e `docs/revolut-audit.md` (ottobre 2025).
