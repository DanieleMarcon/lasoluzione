-- RedefineTables
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_SectionEventItem" (
    "sectionId" INTEGER NOT NULL,
    "eventItemId" TEXT NOT NULL,
    "displayOrder" INTEGER NOT NULL DEFAULT 999,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "showInHome" BOOLEAN NOT NULL DEFAULT false,

    PRIMARY KEY ("sectionId", "eventItemId"),
    CONSTRAINT "SectionEventItem_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CatalogSection" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "SectionEventItem_eventItemId_fkey" FOREIGN KEY ("eventItemId") REFERENCES "EventItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_SectionEventItem" ("sectionId", "eventItemId", "displayOrder", "featured", "showInHome")
SELECT "sectionId", "eventItemId", "displayOrder", "featured", "showInHome" FROM "SectionEventItem";
DROP TABLE "SectionEventItem";
ALTER TABLE "new_SectionEventItem" RENAME TO "SectionEventItem";
CREATE INDEX "SectionEventItem_sectionId_displayOrder_idx" ON "SectionEventItem"("sectionId", "displayOrder");
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
