-- AlterTable
ALTER TABLE "tariff" ADD COLUMN     "is_global" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_local" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "is_regional" BOOLEAN NOT NULL DEFAULT false;
