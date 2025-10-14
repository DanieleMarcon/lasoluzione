# Integrazione Revolut Checkout

## Configurazione
1. Imposta in `.env.local`:
   - `NEXT_PUBLIC_REVOLUT_ENV=sandbox`
   - `NEXT_PUBLIC_REVOLUT_PUBLIC_KEY=pk_test_...`
   - `REVOLUT_SECRET_KEY=sk_test_...`
   - `REVOLUT_API_VERSION=2024-09-01` (o versione supportata dal tuo account)
   - `REVOLUT_API_BASE` (opzionale, es. `https://sandbox-merchant.revolut.com`)
   - `PAY_RETURN_URL` / `PAY_CANCEL_URL` per i redirect (default `/checkout/return|cancel`).
2. Genera le chiavi dal Merchant Dashboard (Section Developers → API Keys → Checkout public token).
3. Abilita il dominio di test nelle impostazioni Revolut se usi il widget embedded.

## Flusso applicativo
- `POST /api/payments/checkout` chiama `createRevolutOrder` (in `src/lib/revolut.ts`) quando `totalCents > 0` e l’email è verificata.
- L’helper costruisce la richiesta `POST /orders` con `amountMinor` in centesimi, `merchant_order_data.reference = order.id` e, se presente, l’email cliente.
- Risposta: `{ paymentRef, checkoutPublicId?, hostedPaymentUrl? }`.
  - `hostedPaymentUrl` viene restituito al client e salvato nel `paymentRef` (JSON) insieme all’esito dell’email pagamento.
  - Se `NEXT_PUBLIC_REVOLUT_PUBLIC_KEY` non è settato, il checkout viene aperto in nuova scheda utilizzando l’URL hosted.
- Il frontend può usare il widget `loadRevolutSDK()` (client helper) passando `checkoutPublicId` + `publicToken`.

## Callback & polling
- Non sono configurati webhook. Lo stato pagamento viene controllato tramite `/api/payments/order-status`, che chiama `retrieveRevolutOrder` e verifica `state === 'completed'`.
- `/api/orders/finalize` serve per marcare l’ordine come pagato lato dominio (aggiorna booking, invia email conferma) una volta verificato il pagamento.

## Errori comuni
| Sintomo | Probabile causa | Fix |
| --- | --- | --- |
| Risposta checkout `{ configWarning: 'NEXT_PUBLIC_REVOLUT_PUBLIC_KEY non configurata' }` | Manca token pubblico | Imposta `NEXT_PUBLIC_REVOLUT_PUBLIC_KEY` o accetta flusso hosted page |
| Errore `Missing REVOLUT_SECRET_KEY` | Secret non impostato o file .env non caricato | Aggiorna `.env.local` e riavvia dev server |
| Redirect `/checkout/return` resta in polling infinito | Revolut order non completato (stato `pending`) | Completa pagamento o annulla; considera implementare webhook per aggiornare stato |
| Risposta `Revolut API 401` nei log | Secret errata o token scaduto | Rigenera la chiave nello user portal |
| Hosted page mostra errore dominio | Domini non configurati in Merchant Portal | Aggiungi dominio nelle impostazioni Checkout -> Allowed domains |

## Suggerimenti
- In ambiente sandbox utilizzare carte test ufficiali (es. `5123 4500 0000 0008`).
- Loggare `paymentRef` per associare eventuali errori email (`emailError`) e timestamp `emailSentAt`.
- Per test manuali del widget: importare dinamicamente `loadRevolutSDK` nel componente client e passare `mode: 'sandbox'`.
