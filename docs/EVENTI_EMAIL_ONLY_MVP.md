# MVP — Prenotazione via email (singolo evento)

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

L’utente riceve una mail con link GET /api/bookings/confirm?token=…

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

GET /api/bookings/confirm?token=...

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
