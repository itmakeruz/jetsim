-- AlterTable
ALTER TABLE "tariff" ADD COLUMN     "region_group_id" INTEGER;

-- AddForeignKey
ALTER TABLE "tariff" ADD CONSTRAINT "tariff_region_group_id_fkey" FOREIGN KEY ("region_group_id") REFERENCES "region_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
