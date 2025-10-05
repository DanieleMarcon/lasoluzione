-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "dinnerCoverCents" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "dinnerItemsJson" JSONB;
ALTER TABLE "Booking" ADD COLUMN "dinnerSubtotalCents" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "dinnerTotalCents" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "tierLabel" TEXT;
ALTER TABLE "Booking" ADD COLUMN "tierPriceCents" INTEGER;
ALTER TABLE "Booking" ADD COLUMN "tierType" TEXT;

-- CreateTable
CREATE TABLE "EventTier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
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
    "dinnerCoverCents" INTEGER NOT NULL DEFAULT 0,
    "dinnerRequirePrepay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_BookingSettings" ("coverCents", "createdAt", "dinnerRequirePrepay", "enableDateTimeStep", "enabledTypes", "fixedDate", "fixedTime", "id", "lunchRequirePrepay", "prepayAmountCents", "prepayTypes", "typeLabels", "updatedAt") SELECT "coverCents", "createdAt", "dinnerRequirePrepay", "enableDateTimeStep", "enabledTypes", "fixedDate", "fixedTime", "id", "lunchRequirePrepay", "prepayAmountCents", "prepayTypes", "typeLabels", "updatedAt" FROM "BookingSettings";
DROP TABLE "BookingSettings";
ALTER TABLE "new_BookingSettings" RENAME TO "BookingSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "EventTier_type_active_order_idx" ON "EventTier"("type", "active", "order");
