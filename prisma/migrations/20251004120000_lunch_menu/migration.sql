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
