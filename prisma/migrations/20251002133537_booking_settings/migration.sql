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
