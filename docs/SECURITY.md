# Sicurezza

## Threat model sintetico
| Componente | Minaccia | Mitigazioni attuali | Note |
| --- | --- | --- | --- |
| Magic link email (NextAuth) | Furto link, enumerazione email | Link valido 10 minuti, whitelist `ADMIN_EMAILS`, cleanup utente non autorizzato, sessione JWT `httpOnly` | Nessun rate limit integrato: usare provider SMTP affidabile e monitorare abuso. |
| Sessione JWT | Replay token, cookie theft | Cookie `next-auth.session-token` è `httpOnly`/`secure` in produzione. Middleware valida token con `NEXTAUTH_SECRET`. | Impostare `NEXTAUTH_URL` corretto per garantire `secure`. Considerare `sameSite='lax'` (default) adeguato. |
| Middleware admin | Bypass diretto API | `middleware.ts` protegge `/admin/:path*`; API admin richiedono sessione valida (`getToken`). | Attenzione a route nuove: assicurarsi che vivano sotto `/admin` o validino token server-side. |
| Checkout & prenotazioni | CSRF, spam | Richieste JSON + cookie `cart_token` `httpOnly`. Validazione Zod e `agreePrivacy` obbligatorio. | Non c'è rate limit → valutare Edge Middleware/Reverse proxy. Considerare captcha per `/api/bookings`. |
| SMTP credentials | Compromissione | Conservate in env `SMTP_*`. NextAuth fallisce all'avvio se mancanti. | Ruotare periodicamente e usare provider con 2FA. |
| Prisma/PostgreSQL | SQL injection, perdita dati | Prisma ORM tipizzato, `DATABASE_URL` segreto. | Configurare backup automatici e rotazione password DB. |

## Header e redirect
- Next.js gestisce automaticamente `X-Frame-Options: SAMEORIGIN`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- Per forzare HTTPS su tutti i domini impostare redirect 301 e HSTS (vedi `docs/BUILD_AND_DEPLOY.md`).
- Considerare CSP custom in `next.config.mjs` se si introduce contenuto esterno dinamico.

## Logging e audit
- NextAuth logga errori su console Vercel (privacy: non include token).
- `src/lib/auth.ts` logga cleanup utenti non autorizzati (`console.warn`). Monitorare per spotting di tentativi di accesso.
- API booking/checkout loggano errori (`console.error`) con stack trace. Configurare forwarding verso un sistema centralizzato (Better Stack/Datadog) per audit.

## Gestione segreti
- Segreti in `.env` / Vercel: `NEXTAUTH_SECRET`, `SMTP_PASS`, `REVOLUT_SECRET_KEY`, `DATABASE_URL`, `DIRECT_URL`.
- Ruotare `NEXTAUTH_SECRET` in caso di sospetto leak (obbliga logout globale).
- Non committare `.env.local`. Usa `docs/.env.example` come riferimento.
- Per debug in locale, tenere `ADMIN_EMAILS` minimale e cambiare password/secret una volta finito.

## Hardening TODO
| Priorità | Attività | Dettagli |
| --- | --- | --- |
| Alta | Implementare rate limiting su `/api/auth/*`, `/api/bookings`, `/api/payments/checkout` | Usare edge middleware, Cloudflare Turnstile o Reverse proxy (Supabase Functions) per ridurre brute-force. |
| Alta | Configurare backup automatici Supabase + test ripristino trimestrale | Script `pg_dump` + restore in ambiente staging. Documentare esito. |
| Media | Abilitare CSP e `Permissions-Policy` | Definire whitelist per script (Next.js, Revolut, analytics) e bloccare embedding non autorizzato. |
| Media | Monitorare login falliti | Inviare alert quando `signIn` ritorna `false` per email non whitelisted o errori SMTP. |
| Media | Verificare redirect `/admin/signin?from=` | Sanitizzare param per evitare open redirect (attualmente limitato a pathname ma aggiungere validazione esplicita). |
| Bassa | Ruotare periodicamente `ADMIN_EMAILS` e cleanup utenti residui | Query Prisma per rimuovere `User` non presenti nella whitelist. |
| Bassa | Documentare processo di rotazione segreti (SMTP, Revolut, Supabase) | Checklist in `OPERATIONS.md`. |

## Check periodici
- Testa login admin una volta a settimana (magic link funzionante, email ricevuta in <1 min).
- Verifica che `NEXTAUTH_URL` in Vercel corrisponda al dominio attivo dopo cambi DNS.
- Controlla i log di Supabase per query lente o errori `connection limit`.
- Aggiorna dipendenze di sicurezza (NextAuth beta, Prisma) pianificando QA su staging.
