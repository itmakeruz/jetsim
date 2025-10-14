/*
  Warnings:

  - You are about to drop the column `name_uz` on the `static_type` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "static_type" DROP COLUMN "name_uz",
ADD COLUMN     "name_en" TEXT;
