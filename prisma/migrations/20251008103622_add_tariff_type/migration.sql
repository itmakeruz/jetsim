-- CreateEnum
CREATE TYPE "TariffType" AS ENUM ('ECONOMY', 'STANDARD', 'TURBO');

-- AlterTable
ALTER TABLE "tariff" ADD COLUMN     "type" "TariffType";
