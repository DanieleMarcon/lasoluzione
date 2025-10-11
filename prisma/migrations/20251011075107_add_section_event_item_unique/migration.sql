/*
  Warnings:

  - A unique constraint covering the columns `[sectionId,eventItemId]` on the table `SectionEventItem` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "SectionEventItem_sectionId_eventItemId_key" ON "SectionEventItem"("sectionId", "eventItemId");
