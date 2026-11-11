-- ISO 3166-1 alpha-2 код страны региона; NULL — регион не страна или код ещё не задан
ALTER TABLE "region" ADD COLUMN "iso_code" TEXT;
CREATE INDEX "region_iso_code_idx" ON "region"("iso_code");
