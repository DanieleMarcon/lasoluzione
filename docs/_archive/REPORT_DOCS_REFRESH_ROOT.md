# Report Audit Documentazione — 2025-10-10

## Sintesi
Ho eseguito una ricognizione completa del progetto Next.js/Prisma verificando App Router, API, hook client (useCart), librerie server (`cart`, `jwt`, `mailer`, `revolut`, `bookingVerification`), schema Prisma e seed. Il focus è stato allineare la documentazione con lo stato reale del codice: flussi checkout email-only/pagamento, dipendenze env (SMTP, Revolut, NEXTAUTH) e boundary frontend/backend.

## File aggiornati
- `README.md`
- `STATE-SNAPSHOT.md`
- `CHANGELOG.md`
- `REPORT_DOCS_REFRESH.md`
- `docs/ARCHITECTURE.md`
- `docs/ROUTES.md`
- `docs/ENVIRONMENT.md`
- `docs/DATABASE.md`
- `docs/EMAIL.md`
- `docs/CHECKOUT_FLOW.md`
- `docs/REVOLUT.md`
- `docs/DEV_GUIDE.md`
- `docs/TROUBLESHOOTING.md`
- `docs/TEST_PLAN.md`

## Decisioni
- Terminologia unificata su “prenotazione via email” per i casi gratuiti.
- Documentazione Revolut limitata a configurazione/uso (nessuna modifica codice) per rispettare il vincolo di audit.
- Descrizione dei token `cart_token` (cookie) e `order_verify_token` (cookie + sessionStorage) per tracciare il flusso di verifica.
- Health check marcati come non eseguiti: audit esclusivamente documentale, nessun comando pesante lanciato.

## TODO puntuali
1. **docs/DEV_GUIDE.md** — aggiungere screenshot aggiornati delle schermate admin (richiede asset grafici). 
2. **docs/TEST_PLAN.md** — predisporre script automatici (es. collection Postman o `npm` script) per testare /api/payments/checkout in CI.
3. **docs/CHECKOUT_FLOW.md** — integrare diagramma visuale (mermaid o immagine) quando saranno disponibili asset grafici.
4. **docs/EMAIL.md** — creare esempi HTML reali dei template principali, prelevandoli da invii reali su ambiente di staging.
