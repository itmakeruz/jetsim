-- DropForeignKey
ALTER TABLE "basket_item" DROP CONSTRAINT "basket_item_tariff_id_fkey";

-- AlterTable
ALTER TABLE "basket_item" ALTER COLUMN "tariff_id" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "basket_item" ADD CONSTRAINT "basket_item_tariff_id_fkey" FOREIGN KEY ("tariff_id") REFERENCES "tariff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
