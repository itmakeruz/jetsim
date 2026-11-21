-- Website visibility is independent of ACTIVE status and reseller availability.
ALTER TABLE "tariff" ADD COLUMN "hide_site" BOOLEAN NOT NULL DEFAULT false;
