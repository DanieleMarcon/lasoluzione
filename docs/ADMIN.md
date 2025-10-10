# Area amministrazione

## Accesso
- Configura `.env.local` con `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, credenziali SMTP e `ADMIN_EMAILS` (lista separata da virgole o punto e virgola).
- Avvia `pnpm dev`, visita `/admin/signin`, inserisci un indirizzo autorizzato e conferma il magic link ricevuto.
- In locale è disponibile `/api/admin/_whoami` per verificare la sessione (solo dev).

## Sommario rapido Eventi & Contatti
- **Eventi** → `/admin/events`: crea/modifica istanze `EventInstance`, abilita la prenotazione “email-only” e gestisci i pacchetti collegati.
- **Contatti** → `/admin/contacts`: vista CRM deduplicata con esportazione CSV, filtri su consensi privacy/newsletter e stampa rapida per il personale di sala.

## Indice sezioni admin
| Percorso | Stato | Descrizione sintetica |
| --- | --- | --- |
| `/admin` | legacy | Dashboard prenotazioni e riepilogo rapide. |
| `/admin/bookings` | legacy | Gestione prenotazioni (filtri, conferme, email). |
| `/admin/menu/dishes` | legacy | CRUD piatti pranzo legacy. |
| `/admin/tiers` | legacy | Gestione pacchetti evento legacy. |
| `/admin/settings` | legacy | Configurazioni `BookingSettings` (coperti, prepay, tipi attivi). |
| `/admin/catalog/products` | nuovo | Catalogo prodotti unificato: create/edit, flag nutrizionali, toggle attivo, slug auto. |
| `/admin/catalog/sections` | nuovo | Attiva/disattiva sezione, `enableDateTime` **solo** per `pranzo`/`cena`, displayOrder e assegnazioni prodotto (featured/home). |
| `/admin/events` | nuovo | Lista Eventi con form creazione, toggle visibilità/home/email-only e gestione pacchetti collegati. |
| `/admin/contacts` | nuovo | CRM contatti deduplicati per email, consensi, storico prenotazioni, esport CSV. |

### Voci legacy

Le voci “Piatti pranzo (Legacy)” e “Opzioni evento/aperitivo (Legacy)” sono nascoste di default. Per riabilitarle in ambienti di migrazione impostare `NEXT_PUBLIC_ADMIN_SHOW_LEGACY=true`.

## Catalogo prodotti
- Lista paginata con ricerca full-text e filtri per categoria/stato.
- Form creazione/modifica: campi descrittivi, prezzo in centesimi, flag nutrizionali (`isVegan`, `containsAlcohol`, ecc.).
- Slug generato automaticamente se non fornito; conflitti restituiscono toast d’errore.
- Azioni: attiva/disattiva prodotto, duplica dati nel form per editing, rimozione (soft toggle `active`).

## Catalogo sezioni
- Tabella sezioni con toggle `active` e ordine (`displayOrder`).
- Pulsante **Abilita data/ora** attivo esclusivamente per le sezioni `pranzo` e `cena`; altrove il bottone resta disabilitato con tooltip esplicativo.
- Modale assegnazioni: ricerca prodotto, impostazione `featured`, `showInHome`, `order` pivot.
- Bottone “Rimuovi” richiede conferma browser prima di chiamare l’API DELETE.

## Eventi
- **Quick start**
  1. Visita `/admin/events` per ottenere la lista paginata filtrabile (stato + ricerca su titolo/slug).
  2. Compila il form in cima alla pagina con titolo, slug e date; spunta **Prenotazione email-only** se vuoi esporre il form pubblico senza pagamento.
  3. Dopo la creazione clicca sul titolo per accedere al dettaglio e gestire i **Pacchetti** (etichetta, prezzo, stato attivo). I pacchetti attivi appaiono automaticamente nel form pubblico come select opzionale.
  4. Usa i toggle **Attivo**/**Mostra in home** per controllare visibilità e promozione; elimina o sospendi gli eventi obsoleti.
- Percorso: `/admin/events` (voce nel menu Catalogo).
- Form in cima alla pagina per creare una nuova `EventInstance` con i campi obbligatori: **Titolo**, **Slug** (minuscolo/kebab-case, validato), **Data inizio** (`startAt` ISO) e flag booleani **Attivo**, **Mostra in home**, **Prenotazione email-only**. Campi opzionali: **Data fine** (`endAt`, deve essere successiva all'inizio), **Descrizione** (max 2000 caratteri) e **Capacità** (intero ≥ 1 oppure vuoto per `null`).
- Le richieste client usano `fetch(..., { cache: 'no-store' })`; il backend valida tutto con Zod e blocca slug duplicati o range data incoerenti.
- Tabella paginata (ordinamento cronologico crescente) con colonne **Titolo**, **Data**, **Slug**, **Attivo**, **Home**, **Email-only** e **Azioni**. Il bottone **Modifica** apre l’editor inline con tutti i campi; **Salva** invia `PATCH /api/admin/events/{id}` e mostra toast di successo/errore.
- Filtri: barra di ricerca (slug/titolo), select per stato (`tutti` / `solo attivi` / `solo sospesi`) e paginazione lato server (`page`, `size`). I risultati vengono ricaricati via API con toast in caso di problemi.
- Azione **Elimina** chiama `DELETE /api/admin/events/{id}`. In caso di vincoli FK l’API effettua fallback soft (set `active=false`) e mostra toast "Evento disattivato".

### Pacchetti evento
- Dalla lista eventi clicca su un elemento per aprire la pagina dettaglio `/admin/events/{id}`.
- Header con titolo, slug, data e pulsante “Apri pubblico” che apre `/eventi/{slug}` in nuova scheda.
- Sezione **Pacchetti**: form “Nuovo pacchetto” con campi etichetta (min 2 caratteri), descrizione opzionale, prezzo in euro, ordine numerico e checkbox attivo.
- L’elenco sottostante mostra i pacchetti esistenti in ordine crescente, con campi editabili inline, prezzo formattato in euro, toggle attivo e azioni **Salva**/**Elimina**.
- Le chiamate usano le rotte: `GET/POST /api/admin/events/{id}/tiers`, `PATCH/DELETE /api/admin/events/tiers/{tierId}` (richiedono `eventId` nel payload per verificare l’appartenenza).
- Tutte le azioni mostrano toast di successo/errore e il salvataggio ricarica la lista corrente.

## Flow Toast Provider
- Provider comune: `src/components/admin/ui/toast.tsx` esporta `<ToastProvider>` e hook `useToast()`.
- Le pagine server-side montano il provider attorno ai client component (`ProductsPageClient`, `SectionsPageClient`).
- Regole: usare `useToast()` solo sotto il provider; i messaggi hanno durata ~3,5 s e si distinguono per variante (`success`, `error`, `info`).

## Sicurezza
- Tutte le rotte `/admin/*` e `/api/admin/*` passano dal middleware Auth.js; utenti non autorizzati vengono reindirizzati a `/admin/signin`.
- Le chiamate fetch dal client admin impostano `cache: 'no-store'` per evitare dati obsoleti.
---

## [P6] Aggiornamenti area Admin

### Prenotazioni
- **Esporta CSV**: pulsante “Esporta CSV” scarica un file con gli stessi filtri correnti.  
  Endpoint: `GET /api/admin/bookings/export?search=...&type=...&status=...&from=...&to=...`
  Colonne incluse: `id,date,type,status,people,name,email,phone,notes,agreePrivacy,agreeMarketing,createdAt`.
- **Nuove colonne**:
  - **Privacy**: ✅ se il cliente ha accettato i termini, altrimenti —.
  - **News**: ✅ se il cliente ha scelto l’iscrizione newsletter, altrimenti —.

### Impostazioni
- **Eventi – prenotazione via email**: elenco istanze evento; il seed crea `capodanno-2025` con toggle ON.
=======

## Prenotazioni
- In `/admin/prenotazioni` è disponibile il bottone **Esporta CSV** accanto a “Stampa elenco”; applica i filtri correnti.
- Rotta tecnica: `GET /api/admin/bookings/export`.
- Parametri supportati (`query`): `search`, `type`, `status`, `from`, `to` (identici ai filtri della lista).
- Colonne esportate in ordine: `id`, `date`, `type`, `status`, `people`, `name`, `email`, `phone`, `notes`, `agreePrivacy`, `agreeMarketing`, `createdAt`.
- Formato: date in ISO 8601 (`toISOString()`), booleani come `TRUE`/`FALSE`, valori testuali sanitizzati (virgolette raddoppiate, newline rimossi).

### Aggiornamenti export Prenotazioni (post-audit)
- Il download genera ora il file `bookings.csv`, coerente con il contenuto esportato.
- Le colonne “Privacy” e “News” mostrano i consensi salvati (`TRUE`/`FALSE` nell'export, badge ✅/— nella UI).

## Contatti
- **Quick start**
  1. Accedi a `/admin/contacts` per la lista deduplicata (una riga per email normalizzata) con colonne su consensi e numero prenotazioni.
  2. Applica i filtri `Privacy`, `Newsletter`, intervallo data e testo libero per segmentare; i risultati vengono ricalcolati lato server.
  3. Stampa la vista dedicata con **Stampa** oppure scarica l’elenco filtrato con **Esporta CSV** per importarlo in altri sistemi CRM/marketing.
- Percorso: `/admin/contacts` (voce "CRM" nella sidebar).
- Elenco deduplicato per email (normalizzate `trim` + lowercase); mostra nome, email, telefono, ultimo consenso privacy/newsletter e numero totale di prenotazioni per quell'indirizzo.
- Filtri disponibili: ricerca full-text (nome/email/telefono), selettori Privacy e Newsletter (tutti/solo sì/solo no), intervallo data creazione (`from`/`to`). Paginazione server-side (20 elementi per pagina).
- Azioni principali: **Stampa** apre `/admin/contacts/print` con layout tipografico, **Esporta CSV** scarica `contacts.csv` mantenendo gli stessi filtri.
- Endpoint esportazione: `GET /api/admin/contacts/export` con query `search`, `newsletter`, `privacy`, `from`, `to`. Colonne in ordine: `name,email,phone,createdAt,agreePrivacy,agreeMarketing,totalBookings` (ISO 8601 per date, booleani `TRUE`/`FALSE`, valori testuali sanitizzati).
