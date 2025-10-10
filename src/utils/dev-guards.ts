// src/utils/dev-guards.ts
import { prisma } from '@/lib/prisma';

export function ensureEventItemModel() {
  if (!(prisma as any)?.eventItem?.findMany) {
    throw new Error(
      'Prisma client non include EventItem. Esegui: `npm run prisma:migrate && npm run prisma:gen`. ' +
        'Controlla che il modello si chiami esattamente `EventItem` e che la route/pagina NON usi runtime Edge.'
    );
  }
}

