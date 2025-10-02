/*
  Warnings:

  - The `quantity_internet` column on the `tariff` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `quantity_minute` column on the `tariff` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `quantity_sms` column on the `tariff` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "tariff" DROP COLUMN "quantity_internet",
ADD COLUMN     "quantity_internet" INTEGER,
DROP COLUMN "quantity_minute",
ADD COLUMN     "quantity_minute" INTEGER,
DROP COLUMN "quantity_sms",
ADD COLUMN     "quantity_sms" INTEGER;
