---
merged_from:
  - docs/EVENTI_EMAIL_ONLY_MVP.md
  - docs/EMAIL_ONLY_BOOKING_TEST.md
updated: 2025-02-14
---
# Prenotazione Solo Email — Guida e QA

> Questo documento sostituisce: `docs/EVENTI_EMAIL_ONLY_MVP.md` e `docs/EMAIL_ONLY_BOOKING_TEST.md`. Include sia la guida MVP sia il piano di test end-to-end.

## Guida MVP & Flusso funzionale

Questa guida descrive il flusso end-to-end per raccogliere prenotazioni **senza pagamento** tramite email di conferma, usando l’istanza evento seedata.

## Scopo
- Pubblicare una pagina evento pubblica con form “Prenota senza pagare”.
- Creare una prenotazione `pending` + inviare email di conferma con token.
- Confermare via link → stato `confirmed`, visibile in Admin.

## Prerequisiti
- `DATABASE_URL` configurato (SQLite in dev).
- NEXTAuth email magic link funzionante: `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `MAIL_FROM`.
- (Facoltativo) `MAIL_TO_BOOKINGS` per inoltro notifica admin.
- `NEXT_PUBLIC_BASE_URL` **o** `APP_BASE_URL` per costruzione link.

## Setup rapido
```bash
pnpm i
# Se non hai ancora applicato le migrazioni:
pnpm prisma migrate dev

# Seed evento singolo (non distruttivo)
pnpm tsx prisma/seed.ts
# oppure, se presente lo script:
pnpm run seed:single-event
```

Evento seedato

Product: serata-capodanno

EventInstance: capodanno-2025

allowEmailOnlyBooking: true

active: true

showOnHome: true

Percorso pubblico

Apri /eventi/capodanno-2025:

Vedi Titolo, Data/Ora, Descrizione.

Form “Prenota senza pagare” con campi:

name*, email*, phone*, people* (>=1), notes

Privacy (obbligatoria) → agreePrivacy: true

Newsletter (opzionale) → agreeMarketing: boolean

Invio → POST /api/bookings/email-only → redirect a
/checkout/email-sent?bookingId=<id>

Conferma via email

L’utente riceve una mail con link GET /api/payments/email-verify?token=…

Apertura link ⇒ Booking: pending → confirmed

Notifica admin inviata (se configurata).

Admin

Impostazioni: l’istanza evento appare in “Eventi – prenotazione via email” con toggle già ON.

Prenotazioni: nuova riga pending → confirmed dopo la conferma.

Export CSV: in Prenotazioni è disponibile il download filtrato.

Colonne: visibili “Privacy” (✅/—) e “News” (✅/—).

Endpoint rilevanti
POST /api/bookings/email-only

Body (esempio):

{
  "eventSlug": "capodanno-2025",
  "name": "Mario Rossi",
  "email": "mario@example.com",
  "phone": "3331234567",
  "people": 2,
  "notes": "Tavolo vicino finestra",
  "agreePrivacy": true,
  "agreeMarketing": false
}


Esito: { "ok": true, "bookingId": "<id>" } e invio email con token.

GET /api/payments/email-verify?token=...

Consuma il token → marca usedAt e conferma la prenotazione.

POST /api/bookings/resend-confirmation

Rigenera il token per prenotazioni pending. Rate-limit con HTTP 429 e header Retry-After.

Comandi utili
# Avvio dev
pnpm dev

# Verifica sessione admin e env in dev
open http://localhost:3000/api/admin/_whoami

## Pacchetti nel form
- Le istanze evento possono avere pacchetti dedicati (`Product` con `sourceType = 'event_instance_tier'`) gestiti dalla pagina `/admin/events/{id}`. L’elenco mostra solo i pacchetti **attivi** ordinati per `order` crescente.
- Se esiste almeno un pacchetto attivo, il form pubblico mostra una select opzionale “Pacchetto” con etichetta e prezzo formattato; il valore inviato corrisponde all’`id` del prodotto.
- Il campo resta facoltativo: gli utenti possono completare la prenotazione anche senza selezionare alcun pacchetto, preservando il flusso email-only originario.

Troubleshooting

Nessuna istanza evento in admin: eseguire seed.

Email non ricevute: verificare SMTP e MAIL_FROM; controllare log del mailer.

429 al resend: attendere i secondi in Retry-After.

Token scaduto/già usato: ripetere con resend, o creare nuova prenotazione.

Non modificato da questo MVP

Flussi di pagamento (Revolut) e carrello restano invariati.

Catalogo Prodotti/Sezioni invariati.

Auth e Middleware invariati.

## Fix post-audit (F1–F4)
- **F1** — L'API `POST /api/bookings/email-only` persiste correttamente il campo `people` dal payload, evitando default errati sul totale partecipanti.
- **F2** — I consensi `agreePrivacy` e `agreeMarketing` vengono salvati e propagati fino alla vista Admin (colonne “Privacy”/“News”).
- **F3** — La validazione blocca prenotazioni su istanze evento inattive anche se chiamate tramite `eventInstanceId`.
- **F4** — L'esportazione Prenotazioni produce `bookings.csv` con le nuove colonne consensi, allineando naming e contenuto.

## Checkout unificato (carrello)
- Il form del checkout raccoglie i consensi privacy/marketing tramite due checkbox aggiuntive (privacy obbligatoria, marketing opzionale).
- Se `totalCents === 0` il checkout crea un ordine `pending` e una prenotazione `pending` con i consensi salvati, invia **solo** la mail “Conferma la tua prenotazione” e attende il click sul link di verifica prima di inviare le email d’ordine.
- Dopo la conferma via `/api/payments/email-verify?token=…` la prenotazione passa a `confirmed`, l’ordine diventa `confirmed` e vengono spedite le due mail d’ordine (cliente + admin) riusando i template esistenti.
- Se `totalCents > 0` il flusso di pagamento Revolut resta invariato; i consensi vengono comunque salvati con l’ordine (o aggiornati sulla prenotazione esistente).
- Esempio payload verso `POST /api/payments/checkout`:

```json
{
  "name": "Mario Rossi",
  "email": "mario@example.com",
  "phone": "3331234567",
  "notes": "Allergie da segnalare",
  "agreePrivacy": true,
  "agreeMarketing": false
}
```

## Flusso email
- **Fase 1** — Invio immediato della mail di verifica al cliente con link `Conferma la tua prenotazione`; nessuna notifica admin viene spedita in questa fase.
- **Fase 2** — Al click sul link di verifica il booking passa a `confirmed`, parte la mail “Prenotazione confermata” al cliente e viene inviata la notifica “Nuova prenotazione confermata” all’admin (se `MAIL_TO_BOOKINGS` è configurata).
- Il payload del form resta invariato e include sempre `agreePrivacy: true` (obbligatorio) e `agreeMarketing` opzionale.
- URL di conferma utilizzato: `/api/payments/email-verify?token=...` (la CTA punta allo stesso endpoint anche quando viene costruito con `NEXT_PUBLIC_BASE_URL`/`APP_BASE_URL`).

## Piano di test end-to-end

## Obiettivo
Verificare end-to-end il percorso di prenotazione senza pagamento, assicurandosi che la creazione pending, l'invio mail, la conferma via link, il resend con rate-limit, l'idempotenza e la visibilità in admin funzionino correttamente.

## Pagina evento pubblica
- Percorso: `/eventi/[slug]` (esempio: `/eventi/capodanno-2025`).
- Dati mostrati: titolo evento, data/ora formattata, descrizione (se presente).
- Form "Prenota senza pagare":
  - Campi obbligatori: nome, email, telefono, numero persone (almeno 1), consenso privacy.
  - Campi opzionali: note, consenso marketing/newsletter.
  - Campo facoltativo pacchetto.
  - Validazioni client: email con pattern base, checkbox privacy obbligatoria.
- Richiesta `POST /api/bookings/email-only` con payload:
  ```json
  {
    "eventSlug": "capodanno-2025",
    "name": "Mario Rossi",
    "email": "mario@example.com",
    "phone": "3331234567",
    "people": 2,
    "notes": "Tavolo vicino finestra",
    "agreePrivacy": true,
    "agreeMarketing": false
  }
  ```
- Esito atteso: redirect a `/checkout/email-sent?bookingId=<id>` con l'identificativo restituito dalla API.
- Nota dev: se `DATABASE_URL` è assente la pagina mostra un messaggio di setup (nessuna query Prisma eseguita).

## Prerequisiti
- Server di sviluppo avviato con `pnpm dev` (verificare che venga caricato `.env.local`).
- Configurazione NEXT Auth corretta (`NEXTAUTH_URL`, `NEXTAUTH_SECRET`).
- SMTP funzionante (Mailtrap consigliato).
- Accesso alla sezione admin (`/admin`).
- L'istanza evento usata nel test deve avere `allowEmailOnlyBooking` attivo.
- Rotte disponibili:
  - `POST /api/bookings/email-only`
  - `POST /api/bookings/resend-confirmation`
  - `GET /api/payments/email-verify?token=...`
- Logger A7 attivo (output JSON in console).
- Base URL pubblico: `NEXT_PUBLIC_BASE_URL` o `APP_BASE_URL` (tipicamente `http://localhost:3000`).

## Flusso di test

### 1. Abilitare il flag sull'evento
1. Accedere all'area admin e aprire l'editor dell'evento.
2. Attivare il toggle **"Abilita prenotazione via email (senza pagamento)"** e salvare.
3. Verificare che al reload il toggle resti attivo e che in DB `EventInstance.allowEmailOnlyBooking = true`.
   - In alternativa usare Prisma Studio/API admin e annotare l'`eventInstanceId`.

### 2. Prenotazione senza pagamento da UI
1. Aprire la pagina checkout dell'evento.
2. Compilare nome, email, telefono e ogni campo richiesto (consensi/note).
3. Cliccare il bottone **"Prenota senza pagare"** (visibile solo con flag attivo).
4. Confermare il redirect verso `/checkout/email-sent?bookingId=…` con messaggio di invito alla conferma e CTA **"Non hai ricevuto la mail?"**.
5. Validare:
   - Log console: record JSON `{"action":"booking.create","outcome":"ok",...}` con `bookingId` ed `eventInstanceId`.
   - DB: `Booking.status = 'pending'` e riga correlata in `BookingVerification` con `expiresAt` futuro e `usedAt = null`.
- Mailbox: due email (cliente: "Conferma la tua prenotazione" con link `/api/payments/email-verify?token=...`; admin: "Prenotazione in attesa").
   - Fallback: recuperare `token` da `BookingVerification` e costruire manualmente l'URL se necessario.

### 3. Conferma via link
1. Aprire il link di conferma dalla mail (`/api/payments/email-verify?token=...`).
2. Atteso: pagina di esito positivo (prenotazione confermata).
3. Verificare:
   - DB: `Booking.status` passa da `pending` a `confirmed`; `BookingVerification.usedAt` valorizzato.
   - Mailbox: due email di conferma (cliente + admin).
   - Log: JSON `{"action":"booking.confirm","outcome":"ok",...}`.

### 4. Resend con rate-limit
1. Tornare su `/checkout/email-sent?bookingId=<id>` di una prenotazione `pending`.
2. Cliccare **"Non hai ricevuto la mail?"**.
   - Prima richiesta: successo (toast/messaggio + nuova mail).
3. Ripetere entro 90 secondi.
   - Atteso: errore di rate-limit, risposta HTTP 429 con header `Retry-After`.
   - Log: `{"action":"booking.resend","outcome":"rate_limited",...}`.
4. Attendere il tempo indicato e ripetere: risposta 200 con mail inviata.
5. Comando `curl` alternativo:
   ```bash
   curl -s -X POST http://localhost:3000/api/bookings/resend-confirmation \\
     -H 'Content-Type: application/json' \\
     -d '{"bookingId": <ID>}' | jq

   curl -i -s -X POST http://localhost:3000/api/bookings/resend-confirmation \\
     -H 'Content-Type: application/json' \\
     -d '{"bookingId": <ID>}'
   ```

### 5. Idempotenza del link
1. Cliccare nuovamente lo stesso link `confirm?token=...` già utilizzato.
   - UI: stato `already_used` (o messaggio equivalente).
   - HTTP: 400 con body `{ ok:false, state:'used' }`.
   - Log: `{"action":"booking.confirm","outcome":"used",...}`.
   - DB: stato resta `confirmed`.
2. Impostare `expiresAt` nel passato e ripetere: atteso stato `expired` con HTTP 400.

### 6. Admin: transizione pending → confirmed
1. Aprire la lista prenotazioni in admin.
2. Verificare che la prenotazione appaia prima con badge `pending` e, dopo la conferma, `confirmed`.
3. Se disponibili azioni manuali admin (confirm/cancel), verificare che non alterino prenotazioni già confermate via link.

### 7. Criteri di accettazione
- CTA "Prenota senza pagare" visibile solo con `allowEmailOnlyBooking` attivo.
- `POST /api/bookings/email-only` crea `Booking.pending`, genera `BookingVerification` e invia email richiesta (cliente) + pending (admin).
- Link `/api/payments/email-verify?token=...` conferma la prenotazione e invia email di conferma a cliente e admin.
- Rate-limit resend: seconda richiesta <90s → 429 + `Retry-After`; >90s → 200.
- Idempotenza: secondo click → stato `used`; token scaduto → `expired`.
- Admin mostra correttamente `pending` → `confirmed`.
- Log JSON presenti per `booking.create`, `booking.resend`, `booking.confirm` (senza token).

## Troubleshooting rapido
- **Email mancanti:** verificare SMTP/Mailtrap e log del mailer (`messageId`). Usare il `token` da `BookingVerification` come fallback.
- **Rate-limit non scatta:** controllare chiave rate-limit (`email|ip`, case-insensitive) e header `x-forwarded-for` (fallback IP locale).
- **CTA non visibile:** confermare `allowEmailOnlyBooking=true` sull'evento e che il checkout utilizzi il flag.
- **Token invalid/expired:** verificare copia `token`, `expiresAt`, `usedAt`.

## Evidenze suggerite
- Screenshot di `/checkout/email-sent` e della conferma positiva.
- Estratti log JSON (uno per `booking.create`, `booking.resend`, `booking.confirm`).
- Output `curl -i` della risposta 429 con `Retry-After`.
- Screenshot Admin con badge `pending` → `confirmed`.

## Seed rapido evento
- Prodotto: slug `serata-capodanno` (creato/aggiornato dal seed).
- Istanza evento: slug `capodanno-2025` con `allowEmailOnlyBooking` già attivo e visibile in home.
- Comando: `pnpm seed:single-event` (richiede dipendenza `tsx`).

## API consensi — email-only

- Endpoint: `POST /api/bookings/email-only`
- Campi richiesti:
  - `eventSlug` (oppure `eventInstanceId`, ma lo slug ha precedenza se entrambi presenti)
  - `name`
  - `email`
  - `phone`
  - `people`
  - `agreePrivacy` (deve essere `true`, altrimenti risposta 400)
- Campi opzionali:
  - `notes`
  - `agreeMarketing` (`false` se omesso)
- Regole:
  - `agreePrivacy` è obbligatorio e deve essere `true`.
  - `agreeMarketing` può essere `true`/`false`; se assente viene salvato come `false`.
  - Se viene fornito sia `eventSlug` sia `eventInstanceId` viene usato lo slug.
  - Se lo slug non esiste o l'evento non è attivo la risposta è 400 con errore `event_slug_not_found`.
  - Se l'evento esiste ma `allowEmailOnlyBooking=false` la risposta è 400 con errore `email_only_not_allowed`.

Esempio request:

```json
{
  "eventSlug": "capodanno-2025",
  "name": "Mario Rossi",
  "email": "mario@example.com",
  "phone": "3331234567",
  "people": 2,
  "notes": "Tavolo finestra",
  "agreePrivacy": true,
  "agreeMarketing": false
}
```

Esempio response:

```json
{ "ok": true, "bookingId": 123 }
```

Errori comuni:

- `event_slug_not_found`: slug inesistente o evento non attivo.
- `event_not_found`: ID evento inesistente.
- `email_only_not_allowed`: l'evento non consente la prenotazione solo email.
- `invalid_payload`: validazione Zod fallita (es. `agreePrivacy` mancante o `false`).
---

## [P6] Aggiornamenti test — consensi e pagina evento
- Il form pubblico in `/eventi/[slug]` raccoglie ora:
  - `agreePrivacy` (**obbligatorio**, deve essere `true`)
  - `agreeMarketing` (facoltativo, `false` di default)
- Il payload di esempio per `POST /api/bookings/email-only` è aggiornato con i due campi (vedi anche `docs/EVENTI_EMAIL_ONLY_MVP.md`).
- Esito atteso:
  - DB: `Booking.agreePrivacy = true`, `Booking.agreeMarketing` coerente con input.
  - Admin → Prenotazioni: compaiono le colonne “Privacy” e “News”.

### Nota post-audit
- La rotta `POST /api/bookings/email-only` legge ora i valori `people`, `agreePrivacy` e `agreeMarketing` direttamente dal payload (nessun fallback server-side), quindi i test devono verificarne la persistenza in DB/Admin.
- Anche passando `eventInstanceId` senza slug, la validazione restituisce 400 se l'istanza evento risulta inattiva (`active = false`).

## Cronologia merge
- Contenuti originali: `docs/EVENTI_EMAIL_ONLY_MVP.md`, `docs/EMAIL_ONLY_BOOKING_TEST.md` (ottobre 2025).
