# Area amministrazione

## Accesso
- Configura `.env.local` con `NEXTAUTH_URL`, `NEXTAUTH_SECRET`, credenziali SMTP e `ADMIN_EMAILS` (lista separata da virgole/punto e virgola).
- Avvia `pnpm dev`, visita `/admin/signin`, inserisci un indirizzo autorizzato e conferma il magic link ricevuto.
- In locale, l’endpoint diagnostico `/api/admin/_whoami` conferma sessione e variabili (solo in dev).

## Navigazione principale
| Percorso | Stato | Descrizione |
| --- | --- | --- |
| `/admin` | legacy | Dashboard metriche prenotazioni con lista “prossime”. |
| `/admin/bookings` | legacy | Gestione prenotazioni (filtri, conferma, email). |
| `/admin/menu/dishes` | legacy | CRUD piatti pranzo (verrà migrata). |
| `/admin/tiers` | legacy | CRUD pacchetti evento/aperitivo legacy. |
| `/admin/settings` | legacy | `BookingSettings` (coperti, prepay, tipi abilitati). |
| `/admin/catalog/products` | nuovo | Catalogo prodotti unificato: create/edit, flag nutrizionali, toggle attivo, slug auto. |
| `/admin/catalog/sections` | nuovo | Toggle sezione, displayOrder, `enableDateTime` (solo `pranzo`/`cena`), assegnazioni prodotto (order/featured/home). |

## Flusso ToastProvider
- `src/components/admin/ui/toast.tsx` fornisce `<ToastProvider>` + `useToast()`.
- Pagine client-side (`ProductForm`, `SectionsPageClient`) sono montate all’interno del provider dal server component.
- Regola: chiamare `useToast()` **solo** nei componenti discendenti; i toast scadono dopo ~3,5s.

## Note rapide
- Tutte le rotte `/api/admin/*` richiedono sessione valida; la middleware reindirizza gli utenti non autorizzati verso `/admin/signin`.
- `enableDateTime` resta limitato alle sezioni pranzo/cena; per le altre la UI mostra un bottone disabilitato.
- Le azioni distruttive (delete prodotto, rimozione assegnazione) mostrano prompt `confirm` prima della chiamata API.
