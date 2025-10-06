/*
  Warnings:

  - You are about to drop the column `regionCategoryId` on the `region` table. All the data in the column will be lost.
  - You are about to drop the column `region_category` on the `region` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "region" DROP COLUMN "regionCategoryId",
DROP COLUMN "region_category";
