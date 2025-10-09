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
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "EventInstance_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_EventInstance" ("active", "allowEmailOnlyBooking", "capacity", "createdAt", "description", "endAt", "id", "productId", "showOnHome", "slug", "startAt", "title", "updatedAt") SELECT "active", "allowEmailOnlyBooking", "capacity", "createdAt", "description", "endAt", "id", "productId", "showOnHome", "slug", "startAt", "title", "updatedAt" FROM "EventInstance";
DROP TABLE "EventInstance";
ALTER TABLE "new_EventInstance" RENAME TO "EventInstance";
CREATE UNIQUE INDEX "EventInstance_slug_key" ON "EventInstance"("slug");
CREATE INDEX "EventInstance_productId_startAt_idx" ON "EventInstance"("productId", "startAt");
CREATE TABLE "new_SectionProduct" (
    "sectionId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "showInHome" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("sectionId", "productId"),
    CONSTRAINT "SectionProduct_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CatalogSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SectionProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_SectionProduct" ("featured", "order", "productId", "sectionId", "showInHome") SELECT "featured", "order", "productId", "sectionId", "showInHome" FROM "SectionProduct";
DROP TABLE "SectionProduct";
ALTER TABLE "new_SectionProduct" RENAME TO "SectionProduct";
CREATE INDEX "SectionProduct_sectionId_order_idx" ON "SectionProduct"("sectionId", "order");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
