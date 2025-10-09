-- CreateTable
CREATE TABLE "BookingVerification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "bookingId" INTEGER NOT NULL,
    "email" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "nonce" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BookingVerification_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_EventInstance" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "productId" INTEGER NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME,
    "showOnHome" BOOLEAN NOT NULL DEFAULT false,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "capacity" INTEGER,
    "allowEmailOnlyBooking" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_EventInstance" ("active", "capacity", "createdAt", "description", "endAt", "id", "productId", "showOnHome", "slug", "startAt", "title", "updatedAt") SELECT "active", "capacity", "createdAt", "description", "endAt", "id", "productId", "showOnHome", "slug", "startAt", "title", "updatedAt" FROM "EventInstance";
DROP TABLE "EventInstance";
ALTER TABLE "new_EventInstance" RENAME TO "EventInstance";
CREATE UNIQUE INDEX "EventInstance_slug_key" ON "EventInstance"("slug");
CREATE INDEX "EventInstance_productId_startAt_idx" ON "EventInstance"("productId", "startAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "BookingVerification_token_key" ON "BookingVerification"("token");

-- CreateIndex
CREATE INDEX "BookingVerification_bookingId_idx" ON "BookingVerification"("bookingId");

-- CreateIndex
CREATE INDEX "BookingVerification_expiresAt_idx" ON "BookingVerification"("expiresAt");
