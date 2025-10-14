/*
  Warnings:

  - The `type` column on the `tariff` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "tariff" DROP COLUMN "type",
ADD COLUMN     "type" TEXT;
