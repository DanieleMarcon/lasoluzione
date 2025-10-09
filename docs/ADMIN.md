# Area amministrazione

## Accesso
- Configura `.env.local` con `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, credenziali SMTP e `ADMIN_EMAILS` (lista separata da virgole o punto e virgola).
- Avvia `pnpm dev`, visita `/admin/signin`, inserisci un indirizzo autorizzato e conferma il magic link ricevuto.
- In locale è disponibile `/api/admin/_whoami` per verificare la sessione (solo dev).

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
- Percorso: `/admin/events` (voce nel menu Catalogo).
- Form in cima alla pagina per creare una nuova `EventInstance` con i campi obbligatori: **Titolo**, **Slug** (minuscolo/kebab-case, validato), **Data inizio** (`startAt` ISO) e flag booleani **Attivo**, **Mostra in home**, **Prenotazione email-only**. Campi opzionali: **Data fine** (`endAt`, deve essere successiva all'inizio), **Descrizione** (max 2000 caratteri) e **Capacità** (intero ≥ 1 oppure vuoto per `null`).
- Le richieste client usano `fetch(..., { cache: 'no-store' })`; il backend valida tutto con Zod e blocca slug duplicati o range data incoerenti.
- Tabella paginata (ordinamento cronologico crescente) con colonne **Titolo**, **Data**, **Slug**, **Attivo**, **Home**, **Email-only** e **Azioni**. Il bottone **Modifica** apre l’editor inline con tutti i campi; **Salva** invia `PATCH /api/admin/events/{id}` e mostra toast di successo/errore.
- Filtri: barra di ricerca (slug/titolo), select per stato (`tutti` / `solo attivi` / `solo sospesi`) e paginazione lato server (`page`, `size`). I risultati vengono ricaricati via API con toast in caso di problemi.
- Azione **Elimina** chiama `DELETE /api/admin/events/{id}`. In caso di vincoli FK l’API effettua fallback soft (set `active=false`) e mostra toast "Evento disattivato".

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
