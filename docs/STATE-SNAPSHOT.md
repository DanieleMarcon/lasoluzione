# STATE SNAPSHOT (read-only for Codex)

## prisma/schema.prisma
```prisma
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "sqlite"
  url      = env("DATABASE_URL")
}

model Booking {
  id             Int            @id @default(autoincrement())
  date           DateTime
  people         Int
  name           String
  email          String
  phone          String
  notes          String?

  // 👇 aggiunte
  type           BookingType
  agreePrivacy   Boolean        @default(false)
  agreeMarketing Boolean        @default(false)
  status         BookingStatus  @default(pending)
  prepayToken    String?

  lunchItemsJson      Json?
  coverCents          Int?
  subtotalCents       Int?
  totalCents          Int?
  dinnerItemsJson     Json?
  dinnerSubtotalCents Int?
  dinnerCoverCents    Int?
  dinnerTotalCents    Int?
  tierType            String?
  tierLabel           String?
  tierPriceCents      Int?

  createdAt      DateTime       @default(now())
  updatedAt      DateTime       @updatedAt
}

model BookingSettings {
  id                  Int      @id @default(1)
  enableDateTimeStep  Boolean  @default(true)
  fixedDate           DateTime?
  fixedTime           String?
  enabledTypes        Json
  typeLabels          Json
  prepayTypes         Json
  prepayAmountCents   Int?
  coverCents          Int      @default(0)
  lunchRequirePrepay  Boolean  @default(false)
  dinnerCoverCents    Int      @default(0)
  createdAt           DateTime @default(now())
  updatedAt           DateTime @updatedAt
}

enum BookingType {
  pranzo
  aperitivo
  evento
}

enum BookingStatus {
  pending
  pending_payment
  confirmed
  failed
  expired
  cancelled
}

model MenuDish {
  id          Int      @id @default(autoincrement())
  name        String
  slug        String   @unique
  description String?
  priceCents  Int      @default(0)
  active      Boolean  @default(true)
  category    String?
  order       Int      @default(0)
  visibleAt   String   @default("both") // lunch | dinner | both
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
}

model EventTier {
  id         String  @id @default(cuid())
  type       String
  label      String
  priceCents Int
  active     Boolean @default(true)
  order      Int     @default(0)

  @@index([type, active, order])
}

model User {
  id            String    @id @default(cuid())
  name          String?
  email         String?   @unique
  emailVerified DateTime?
  image         String?
  role          UserRole  @default(admin)

  accounts Account[]
  sessions Session[]
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  refresh_token     String?
  access_token      String?
  expires_at        Int?
  token_type        String?
  scope             String?
  id_token          String?
  session_state     String?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

model VerificationToken {
  identifier String
  token      String   @unique
  expires    DateTime

  @@unique([identifier, token])
}

enum UserRole {
  admin
}
```

## prisma/migrations (first 80 lines each)

```sql
## prisma/migrations/20251001150916_init/migration.sql
-- CreateTable
CREATE TABLE "Booking" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "people" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);


## prisma/migrations/20251002071639_add_type_and_flags/migration.sql
/*
  Warnings:

  - You are about to drop the column `status` on the `Booking` table. All the data in the column will be lost.
  - Added the required column `type` to the `Booking` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Booking" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "people" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "notes" TEXT,
    "type" TEXT NOT NULL,
    "agreePrivacy" BOOLEAN NOT NULL DEFAULT false,
    "agreeMarketing" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Booking" ("createdAt", "date", "email", "id", "name", "notes", "people", "phone") SELECT "createdAt", "date", "email", "id", "name", "notes", "people", "phone" FROM "Booking";
DROP TABLE "Booking";
ALTER TABLE "new_Booking" RENAME TO "Booking";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


## prisma/migrations/20251002133537_booking_settings/migration.sql
/*
  Warnings:

  - Made the column `phone` on table `Booking` required. This step will fail if there are existing NULL values in that column.

*/
-- CreateTable
CREATE TABLE "BookingSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "enableDateTimeStep" BOOLEAN NOT NULL DEFAULT true,
    "fixedDate" DATETIME,
    "fixedTime" TEXT,
    "enabledTypes" TEXT NOT NULL,
    "typeLabels" TEXT NOT NULL,
    "prepayTypes" TEXT NOT NULL,
    "prepayAmountCents" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT OR IGNORE INTO "BookingSettings" (
    "id",
    "enableDateTimeStep",
    "fixedDate",
    "fixedTime",
    "enabledTypes",
    "typeLabels",
    "prepayTypes",
    "prepayAmountCents",
    "createdAt",
    "updatedAt"
  )
  VALUES (
    1,
    0,
    '2025-12-20T00:00:00.000Z',
    '19:00',
    json('["pranzo","evento"]'),
    json('{"pranzo":"Pranzo","evento":"Serata Speciale"}'),
    json('["evento"]'),
    1500,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
  );

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Booking" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "people" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "notes" TEXT,
    "type" TEXT NOT NULL,
    "agreePrivacy" BOOLEAN NOT NULL DEFAULT false,
    "agreeMarketing" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "prepayToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_Booking" ("agreeMarketing", "agreePrivacy", "createdAt", "date", "email", "id", "name", "notes", "people", "phone", "type") SELECT "agreeMarketing", "agreePrivacy", "createdAt", "date", "email", "id", "name", "notes", "people", "phone", "type" FROM "Booking";
DROP TABLE "Booking";
ALTER TABLE "new_Booking" RENAME TO "Booking";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


## prisma/migrations/20251002160000_admin_auth/migration.sql
-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "emailVerified" DATETIME,
    "image" TEXT,
    "role" TEXT NOT NULL DEFAULT 'admin'
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" DATETIME NOT NULL,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Booking" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "date" DATETIME NOT NULL,
    "people" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "notes" TEXT,
    "type" TEXT NOT NULL,
    "agreePrivacy" BOOLEAN NOT NULL DEFAULT false,
    "agreeMarketing" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "prepayToken" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Booking" ("agreeMarketing", "agreePrivacy", "createdAt", "date", "email", "id", "name", "notes", "people", "phone", "prepayToken", "status", "type") SELECT "agreeMarketing", "agreePrivacy", "createdAt", "date", "email", "id", "name", "notes", "people", "phone", "prepayToken", "status", "type" FROM "Booking";
DROP TABLE "Booking";
ALTER TABLE "new_Booking" RENAME TO "Booking";
CREATE TABLE "new_BookingSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "enableDateTimeStep" BOOLEAN NOT NULL DEFAULT true,
    "fixedDate" DATETIME,
    "fixedTime" TEXT,
    "enabledTypes" JSON NOT NULL,
    "typeLabels" JSON NOT NULL,
    "prepayTypes" JSON NOT NULL,
    "prepayAmountCents" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BookingSettings" ("createdAt", "enableDateTimeStep", "enabledTypes", "fixedDate", "fixedTime", "id", "prepayAmountCents", "prepayTypes", "typeLabels", "updatedAt") SELECT "createdAt", "enableDateTimeStep", "enabledTypes", "fixedDate", "fixedTime", "id", "prepayAmountCents", "prepayTypes", "typeLabels", "updatedAt" FROM "BookingSettings";
DROP TABLE "BookingSettings";
ALTER TABLE "new_BookingSettings" RENAME TO "BookingSettings";


## prisma/migrations/20251003051448_admin_auth/migration.sql
/*
  Warnings:

  - You are about to alter the column `enabledTypes` on the `BookingSettings` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("json")` to `Json`.
  - You are about to alter the column `prepayTypes` on the `BookingSettings` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("json")` to `Json`.
  - You are about to alter the column `typeLabels` on the `BookingSettings` table. The data in that column could be lost. The data in that column will be cast from `Unsupported("json")` to `Json`.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BookingSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "enableDateTimeStep" BOOLEAN NOT NULL DEFAULT true,
    "fixedDate" DATETIME,
    "fixedTime" TEXT,
    "enabledTypes" JSONB NOT NULL,
    "typeLabels" JSONB NOT NULL,
    "prepayTypes" JSONB NOT NULL,
    "prepayAmountCents" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BookingSettings" ("createdAt", "enableDateTimeStep", "enabledTypes", "fixedDate", "fixedTime", "id", "prepayAmountCents", "prepayTypes", "typeLabels", "updatedAt") SELECT "createdAt", "enableDateTimeStep", "enabledTypes", "fixedDate", "fixedTime", "id", "prepayAmountCents", "prepayTypes", "typeLabels", "updatedAt" FROM "BookingSettings";
DROP TABLE "BookingSettings";
ALTER TABLE "new_BookingSettings" RENAME TO "BookingSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;


## prisma/migrations/20251004120000_lunch_menu/migration.sql
-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "coverCents" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "lunchItemsJson" JSONB;
ALTER TABLE "Booking" ADD COLUMN "subtotalCents" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "totalCents" INTEGER;

-- CreateTable
CREATE TABLE "MenuDish" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "priceCents" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "category" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BookingSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "enableDateTimeStep" BOOLEAN NOT NULL DEFAULT true,
    "fixedDate" DATETIME,
    "fixedTime" TEXT,
    "enabledTypes" JSONB NOT NULL,
    "typeLabels" JSONB NOT NULL,
    "prepayTypes" JSONB NOT NULL,
    "prepayAmountCents" INTEGER,
    "coverCents" INTEGER NOT NULL DEFAULT 0,
    "lunchRequirePrepay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BookingSettings" ("createdAt", "enableDateTimeStep", "enabledTypes", "fixedDate", "fixedTime", "id", "prepayAmountCents", "prepayTypes", "typeLabels", "updatedAt")
SELECT "createdAt", "enableDateTimeStep", "enabledTypes", "fixedDate", "fixedTime", "id", "prepayAmountCents", "prepayTypes", "typeLabels", "updatedAt" FROM "BookingSettings";
DROP TABLE "BookingSettings";
ALTER TABLE "new_BookingSettings" RENAME TO "BookingSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "MenuDish_slug_key" ON "MenuDish"("slug");


```

## prisma/seed.ts (first 300 lines)

```ts
// prisma/seed.ts
import { PrismaClient } from '@prisma/client';
import { getAdminEmails } from '@/lib/admin/emails';

const prisma = new PrismaClient();

async function seedAdminUsers() {
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

async function seedMenuDishes() {
  const dishes = [
    {
      slug: 'bruschette-miste',
      name: 'Bruschette miste',
      description: 'Pane tostato con pomodoro, olive e crema di ceci',
      priceCents: 600,
      category: 'Antipasti',
      order: 10,
      visibleAt: 'both' as const,
    },
    {
      slug: 'insalata-di-stagione',
      name: 'Insalata di stagione',
      description: 'Verdure croccanti con dressing leggero',
      priceCents: 500,
      category: 'Antipasti',
      order: 20,
      visibleAt: 'lunch' as const,
    },
    {
      slug: 'lasagna-vegetariana',
      name: 'Lasagna vegetariana',
      description: 'Con ragù di verdure e besciamella fatta in casa',
      priceCents: 1200,
      category: 'Primi',
      order: 30,
      visibleAt: 'both' as const,
    },
    {
      slug: 'carbonara-cremosa',
      name: 'Carbonara cremosa',
      description: 'Guanciale croccante e pecorino romano DOP',
      priceCents: 1100,
      category: 'Primi',
      order: 40,
      visibleAt: 'dinner' as const,
    },
    {
      slug: 'tiramisu-della-casa',
      name: 'Tiramisù della casa',
      description: 'Classico con mascarpone fresco',
      priceCents: 0,
      category: 'Dolci',
      order: 50,
      visibleAt: 'both' as const,
    },
    {
      slug: 'acqua-naturalmente',
      name: 'Acqua naturale 75cl',
      description: 'Inclusa nel menu pranzo',
      priceCents: 0,
      category: 'Bevande',
      order: 60,
      visibleAt: 'both' as const,
    },
  ];

  for (const dish of dishes) {
    await prisma.menuDish.upsert({
      where: { slug: dish.slug },
      update: {
        name: dish.name,
        description: dish.description,
        priceCents: dish.priceCents,
        category: dish.category,
        order: dish.order,
        visibleAt: dish.visibleAt,
        active: true,
      },
      create: {
        ...dish,
        active: true,
      },
    });
  }

  console.log('[seed] Catalogo piatti pranzo aggiornato');
}

async function seedBookingSettings() {
  await prisma.bookingSettings.upsert({
    where: { id: 1 },
    update: {
      coverCents: 200,
      lunchRequirePrepay: false,
      dinnerCoverCents: 200,
    },
    create: {
      id: 1,
      enableDateTimeStep: true,
      fixedDate: null,
      fixedTime: null,
      enabledTypes: ['pranzo', 'evento'],
      typeLabels: { pranzo: 'Pranzo', evento: 'Evento' },
      prepayTypes: [],
      prepayAmountCents: null,
      coverCents: 200,
      lunchRequirePrepay: false,
      dinnerCoverCents: 200,
    },
  });

  console.log('[seed] BookingSettings aggiornate con coverCents e lunchRequirePrepay');
}

async function seedEventTiers() {
  const tiers = [
    { type: 'evento', label: 'Ingresso standard', priceCents: 1500, order: 10 },
    { type: 'evento', label: 'Ingresso VIP', priceCents: 3000, order: 20 },
    { type: 'aperitivo', label: 'Calice singolo', priceCents: 800, order: 10 },
    { type: 'aperitivo', label: 'Formula tapas', priceCents: 1800, order: 20 },
  ];

  for (const tier of tiers) {
    await prisma.eventTier.upsert({
      where: {
        id: `${tier.type}-${tier.label}`,
      },
      update: {
        label: tier.label,
        priceCents: tier.priceCents,
        order: tier.order,
        active: true,
      },
      create: {
        id: `${tier.type}-${tier.label}`,
        type: tier.type,
        label: tier.label,
        priceCents: tier.priceCents,
        order: tier.order,
        active: true,
      },
    });
  }

  console.log('[seed] Event tiers aggiornati');
}

async function main() {
  await seedAdminUsers();
  await seedMenuDishes();
  await seedBookingSettings();
  await seedEventTiers();
}

main()
  .catch((error) => {
    console.error('[seed] errore', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

## src/lib/bookingSettings.ts (first 200 lines)

```ts
import type { BookingType } from '@prisma/client';
import type { Prisma } from '@prisma/client';
import { prisma } from './prisma';
import type { BookingConfigDTO } from '@/types/bookingConfig';

export type NormalizedBookingSettings = {
  enableDateTimeStep: boolean;
  fixedDate?: Date;
  fixedTime?: string;
  enabledTypes: BookingType[];
  typeLabels: Record<string, string>;
  prepayTypes: BookingType[];
  prepayAmountCents?: number;
  coverCents: number;
  lunchRequirePrepay: boolean;
};

const DEFAULT_BOOKING_SETTINGS: NormalizedBookingSettings = {
  enableDateTimeStep: false,
  fixedDate: new Date('2025-12-20T00:00:00.000Z'),
  fixedTime: '19:00',
  enabledTypes: ['pranzo', 'evento'],
  typeLabels: { pranzo: 'Pranzo', evento: 'Serata Speciale' },
  prepayTypes: ['evento'],
  prepayAmountCents: 1500,
  coverCents: 0,
  lunchRequirePrepay: false,
};

function asStringArray(value: Prisma.JsonValue | null | undefined, fallback: BookingType[]): BookingType[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is BookingType => typeof item === 'string') as BookingType[];
  }
  return fallback;
}

function asRecord(value: Prisma.JsonValue | null | undefined, fallback: Record<string, string>) {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    const entries = Object.entries(value).filter(([, v]) => typeof v === 'string');
    return Object.fromEntries(entries) as Record<string, string>;
  }
  return fallback;
}

export async function getBookingSettings(): Promise<NormalizedBookingSettings> {
  const row = await prisma.bookingSettings.findUnique({ where: { id: 1 } });

  if (!row) {
    return { ...DEFAULT_BOOKING_SETTINGS };
  }

  const enabledTypes = asStringArray(row.enabledTypes as Prisma.JsonValue, DEFAULT_BOOKING_SETTINGS.enabledTypes);
  const typeLabels = asRecord(row.typeLabels as Prisma.JsonValue, DEFAULT_BOOKING_SETTINGS.typeLabels);
  const prepayTypes = asStringArray(row.prepayTypes as Prisma.JsonValue, DEFAULT_BOOKING_SETTINGS.prepayTypes);

  return {
    enableDateTimeStep: row.enableDateTimeStep,
    fixedDate: row.fixedDate ?? DEFAULT_BOOKING_SETTINGS.fixedDate,
    fixedTime: row.fixedTime ?? DEFAULT_BOOKING_SETTINGS.fixedTime,
    enabledTypes: [...enabledTypes],
    typeLabels: { ...typeLabels },
    prepayTypes: [...prepayTypes],
    prepayAmountCents: row.prepayAmountCents ?? DEFAULT_BOOKING_SETTINGS.prepayAmountCents,
    coverCents: row.coverCents ?? DEFAULT_BOOKING_SETTINGS.coverCents,
    lunchRequirePrepay: row.lunchRequirePrepay ?? DEFAULT_BOOKING_SETTINGS.lunchRequirePrepay,
  };
}

export function toBookingConfigDTO(
  settings: NormalizedBookingSettings,
  menu: BookingConfigDTO['menu'],
): BookingConfigDTO {
  const fixedDate = settings.fixedDate?.toISOString().slice(0, 10);
  return {
    enableDateTimeStep: settings.enableDateTimeStep,
    ...(fixedDate ? { fixedDate } : {}),
    ...(settings.fixedTime ? { fixedTime: settings.fixedTime } : {}),
    enabledTypes: settings.enabledTypes,
    typeLabels: settings.typeLabels,
    prepayTypes: settings.prepayTypes,
    ...(settings.prepayAmountCents != null ? { prepayAmountCents: settings.prepayAmountCents } : {}),
    menu,
  };
}

export function resolveBookingDate(
  settings: NormalizedBookingSettings,
  requestedDate: string,
  requestedTime: string,
): Date {
  const targetDate = settings.enableDateTimeStep
    ? requestedDate
    : settings.fixedDate?.toISOString().slice(0, 10) ?? requestedDate;
  const targetTime = settings.enableDateTimeStep ? requestedTime : settings.fixedTime ?? requestedTime;

  const iso = `${targetDate}T${targetTime}:00`;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Invalid date/time configuration');
  }
  return date;
}

export function typeRequiresPrepay(settings: NormalizedBookingSettings, type: string): boolean {
  if (type === 'pranzo' && settings.lunchRequirePrepay) {
    return true;
  }
  return settings.prepayTypes.includes(type as BookingType);
}

export const DEFAULT_BOOKING_CONFIG_DTO: BookingConfigDTO = toBookingConfigDTO(DEFAULT_BOOKING_SETTINGS, {
  dishes: [],
  coverCents: DEFAULT_BOOKING_SETTINGS.coverCents,
  lunchRequirePrepay: DEFAULT_BOOKING_SETTINGS.lunchRequirePrepay,
});
```

## src/types/bookingConfig.ts (first 200 lines)

```ts
export type BookingMenuDishDTO = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  priceCents: number;
  active: boolean;
  category?: string;
  order: number;
  visibleAt: 'lunch' | 'dinner' | 'both';
};

export type BookingMenuDTO = {
  dishes: BookingMenuDishDTO[];
  coverCents: number;
  dinnerCoverCents: number;
  lunchRequirePrepay: boolean;
};

export type BookingTierDTO = {
  id: string;
  type: 'evento' | 'aperitivo';
  label: string;
  priceCents: number;
  active: boolean;
  order: number;
};

export type BookingTiersDTO = {
  evento: BookingTierDTO[];
  aperitivo: BookingTierDTO[];
};

export type BookingConfigDTO = {
  enableDateTimeStep: boolean;
  fixedDate?: string;
  fixedTime?: string;
  enabledTypes: string[];
  typeLabels: Record<string, string>;
  prepayTypes: string[];
  prepayAmountCents?: number;
  menu: BookingMenuDTO;
  tiers: BookingTiersDTO;
};
```
