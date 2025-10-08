// prisma.config.ts
import 'dotenv/config';              // carica .env
import { defineConfig } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    seed: 'tsx prisma/seed.ts',
  },
});
