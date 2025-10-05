-- Add missing columns on SQLite

-- 1) BookingSettings.dinnerRequirePrepay
ALTER TABLE "BookingSettings"
ADD COLUMN "dinnerRequirePrepay" BOOLEAN NOT NULL DEFAULT false;

-- 2) MenuDish.visibleAt
ALTER TABLE "MenuDish"
ADD COLUMN "visibleAt" TEXT NOT NULL DEFAULT 'both';
