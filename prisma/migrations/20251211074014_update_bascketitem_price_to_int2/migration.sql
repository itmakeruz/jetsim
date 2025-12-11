/*
  Warnings:

  - The `price` column on the `basket_item` table would be dropped and recreated. This will lead to data loss if there is data in the column.

*/
-- AlterTable
ALTER TABLE "basket_item" DROP COLUMN "price",
ADD COLUMN     "price" INTEGER;
