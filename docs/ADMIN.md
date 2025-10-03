# Auth & Admin

## Variabili richieste
Aggiungi queste chiavi a `.env.local` prima di avviare il progetto:

```
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<stringa_random>
MAIL_FROM="Bar La Soluzione <no-reply@lasoluzione.eu>"
SMTP_HOST=...
SMTP_PORT=465
SMTP_USER=...
SMTP_PASS=...
ADMIN_EMAILS=you@example.com,other@example.com
```

- `NEXTAUTH_SECRET`: genera un valore sicuro con
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- `ADMIN_EMAILS`: puoi separare gli indirizzi con virgole **o** punti e virgola; non è case-sensitive.

## Debug in locale
1. Avvia `pnpm dev`.
2. Visita `/admin/signin`, inserisci un indirizzo presente in `ADMIN_EMAILS` e conferma il magic link ricevuto.
3. Con sessione attiva, apri `/api/admin/_whoami` per vedere:
   - Se il token è presente (`token.raw`).
   - Quale indirizzo email è stato estratto (`token.email`).
   - La whitelist normalizzata.
   - Quali variabili ambiente critiche risultano impostate.

> ℹ️ L'endpoint di debug è disponibile **solo in sviluppo** e risponde 404 in produzione.

## Loop e accessi
- Il middleware (`src/middleware.ts`) esclude automaticamente `/api/auth`, gli asset e le pagine pubbliche (`/admin/signin`, `/admin/not-authorized`).
- Utenti non autenticati vengono reindirizzati a `/admin/signin?from=<percorso>`.
- Utenti autenticati ma non nella whitelist finiscono su `/admin/not-authorized` (in dev viene loggato un avviso in console).
