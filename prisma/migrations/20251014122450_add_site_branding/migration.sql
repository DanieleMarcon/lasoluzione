-- Add JSON site field to BookingSettings
ALTER TABLE "BookingSettings" ADD COLUMN "site" JSONB;
