/*
  Warnings:

  - Made the column `phone` on table `Order` required. This step will fail if there are existing NULL values in that column.

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
    "phone" TEXT NOT NULL,
    "notes" TEXT,
    "type" TEXT NOT NULL,
    "agreePrivacy" BOOLEAN NOT NULL DEFAULT false,
    "agreeMarketing" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "prepayToken" TEXT,
    "lunchItemsJson" JSONB,
    "coverCents" INTEGER,
    "subtotalCents" INTEGER,
    "totalCents" INTEGER,
    "dinnerItemsJson" JSONB,
    "dinnerSubtotalCents" INTEGER,
    "dinnerCoverCents" INTEGER,
    "dinnerTotalCents" INTEGER,
    "tierType" TEXT,
    "tierLabel" TEXT,
    "tierPriceCents" INTEGER,
    "orderId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Booking_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Booking" ("agreeMarketing", "agreePrivacy", "coverCents", "createdAt", "date", "dinnerCoverCents", "dinnerItemsJson", "dinnerSubtotalCents", "dinnerTotalCents", "email", "id", "lunchItemsJson", "name", "notes", "orderId", "people", "phone", "prepayToken", "status", "subtotalCents", "tierLabel", "tierPriceCents", "tierType", "totalCents", "type", "updatedAt") SELECT "agreeMarketing", "agreePrivacy", "coverCents", "createdAt", "date", "dinnerCoverCents", "dinnerItemsJson", "dinnerSubtotalCents", "dinnerTotalCents", "email", "id", "lunchItemsJson", "name", "notes", "orderId", "people", "phone", "prepayToken", "status", "subtotalCents", "tierLabel", "tierPriceCents", "tierType", "totalCents", "type", "updatedAt" FROM "Booking";
DROP TABLE "Booking";
ALTER TABLE "new_Booking" RENAME TO "Booking";
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cartId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "notes" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalCents" INTEGER NOT NULL,
    "discountCents" INTEGER,
    "paymentRef" TEXT,
    "providerRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("cartId", "createdAt", "discountCents", "email", "id", "name", "paymentRef", "phone", "status", "totalCents", "updatedAt")
SELECT "cartId", "createdAt", "discountCents", "email", "id", "name", "paymentRef", COALESCE("phone", ''), "status", "totalCents", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_cartId_key" ON "Order"("cartId");
CREATE UNIQUE INDEX "Order_providerRef_key" ON "Order"("providerRef");
CREATE INDEX "Order_cartId_status_idx" ON "Order"("cartId", "status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
