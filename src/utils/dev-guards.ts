// src/utils/dev-guards.ts
import { prisma } from '@/lib/prisma';

export function ensureEventItemModel() {
  if (process.env.NODE_ENV === 'development') {
    // in debug: non lanciare, lasciamo girare e usiamo /api/_debug/prisma
    return;
  }
  if (!(prisma as any)?.eventItem?.findMany) {
    throw new Error(
      'Prisma client non include EventItem. Esegui: `npm run prisma:migrate && npm run prisma:gen`. ' +
        'Controlla che il modello si chiami esattamente `EventItem` e che la route/pagina NON usi runtime Edge.'
    );
  }
}

