/*
  Warnings:

  - You are about to drop the column `providerRef` on the `Order` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "cartId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "totalCents" INTEGER NOT NULL,
    "discountCents" INTEGER,
    "paymentRef" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_cartId_fkey" FOREIGN KEY ("cartId") REFERENCES "Cart" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Order" ("cartId", "createdAt", "discountCents", "email", "id", "name", "notes", "paymentRef", "phone", "status", "totalCents", "updatedAt") SELECT "cartId", "createdAt", "discountCents", "email", "id", "name", "notes", "paymentRef", "phone", "status", "totalCents", "updatedAt" FROM "Order";
DROP TABLE "Order";
ALTER TABLE "new_Order" RENAME TO "Order";
CREATE UNIQUE INDEX "Order_cartId_key" ON "Order"("cartId");
CREATE INDEX "Order_cartId_status_idx" ON "Order"("cartId", "status");
CREATE INDEX "Order_paymentRef_idx" ON "Order"("paymentRef");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
