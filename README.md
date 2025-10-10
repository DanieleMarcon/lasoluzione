# La Soluzione

Next.js 14 App Router project that powers La Soluzione's public site, booking cart and admin tools. It serves a marketing home, a booking experience that mixes legacy wizard and cart checkout, and a protected admin area with Auth.js email magic links. Checkout supports email-only confirmation and Revolut hosted payments while sharing a single Prisma database.

## Requisiti
- Node.js 20+
- pnpm 9+
- SQLite (file `dev.db` gestito da Prisma)

## Setup rapido
```bash
pnpm install
cp .env.example .env.local   # compila SMTP, NEXTAUTH_SECRET, Revolut
pnpm prisma db push
pnpm dev
```

## Script utili
- `pnpm dev` – avvia Next.js in sviluppo
- `pnpm build` – build di produzione
- `pnpm start` – serve la build
- `pnpm lint` – linting Next/ESLint
- `pnpm prisma migrate reset` – reset database (cancella dati)
- `pnpm prisma db push` – sincronizza schema con SQLite
- `pnpm tsx prisma/seed.ts` – seed non distruttivo dei dati demo

## Documentazione
- [STATE-SNAPSHOT](STATE-SNAPSHOT.md)
- [Changelog](CHANGELOG.md)
- [Report audit documentazione](REPORT_DOCS_REFRESH.md)
- [Architettura](docs/ARCHITECTURE.md)
- [Routing](docs/ROUTES.md)
- [Ambiente](docs/ENVIRONMENT.md)
- [Database](docs/DATABASE.md)
- [Email](docs/EMAIL.md)
- [Checkout flow](docs/CHECKOUT_FLOW.md)
- [Integrazione Revolut](docs/REVOLUT.md)
- [Guida sviluppo](docs/DEV_GUIDE.md)
- [Troubleshooting](docs/TROUBLESHOOTING.md)
- [Test plan](docs/TEST_PLAN.md)
