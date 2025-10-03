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
