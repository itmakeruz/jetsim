/*
  Warnings:

  - You are about to drop the column `description_en` on the `tariff` table. All the data in the column will be lost.
  - You are about to drop the column `description_ru` on the `tariff` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "tariff" DROP COLUMN "description_en",
DROP COLUMN "description_ru";
