// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { getAdminEmails } from '@/lib/admin/emails';

const prisma = new PrismaClient();

async function main() {
  const adminEmails = getAdminEmails();

  if (!adminEmails.length) {
    console.warn('[seed] ADMIN_EMAILS è vuoto: nessun utente admin creato');
    return;
  }

  for (const email of adminEmails) {
    await prisma.user.upsert({
      where: { email },
      update: { role: 'admin' },
      create: {
        email,
        role: 'admin',
        name: email.split('@')[0]
      }
    });
  }

  console.log(`[seed] Creati/aggiornati ${adminEmails.length} utenti admin`);
}

main()
  .catch((error) => {
    console.error('[seed] errore', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
