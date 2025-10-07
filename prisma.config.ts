// prisma.config.ts
import { defineConfig } from "prisma/config";

export default defineConfig({
  // schema: "prisma/schema.prisma", // default
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
