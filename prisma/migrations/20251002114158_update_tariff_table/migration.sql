/*
  Warnings:

  - You are about to drop the column `package_id` on the `basket_item` table. All the data in the column will be lost.
  - You are about to drop the column `package_id` on the `order` table. All the data in the column will be lost.
  - Added the required column `tariff_id` to the `basket_item` table without a default value. This is not possible if the table is not empty.
  - Added the required column `sku_id` to the `tariff` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "basket_item" DROP CONSTRAINT "basket_item_package_id_fkey";

-- DropForeignKey
ALTER TABLE "order" DROP CONSTRAINT "order_package_id_fkey";

-- DropForeignKey
ALTER TABLE "package" DROP CONSTRAINT "package_tariff_id_fkey";

-- AlterTable
ALTER TABLE "basket_item" DROP COLUMN "package_id",
ADD COLUMN     "tariff_id" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "order" DROP COLUMN "package_id",
ADD COLUMN     "packageId" INTEGER;

-- AlterTable
ALTER TABLE "tariff" ADD COLUMN     "cashback_percent" INTEGER,
ADD COLUMN     "price_arrival" INTEGER,
ADD COLUMN     "price_sell" INTEGER,
ADD COLUMN     "quantity_internet" TEXT,
ADD COLUMN     "quantity_minute" TEXT,
ADD COLUMN     "quantity_sms" TEXT,
ADD COLUMN     "sku_id" TEXT NOT NULL,
ADD COLUMN     "validity_period" INTEGER;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "package"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "basket_item" ADD CONSTRAINT "basket_item_tariff_id_fkey" FOREIGN KEY ("tariff_id") REFERENCES "tariff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
