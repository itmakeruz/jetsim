/*
  Warnings:

  - You are about to drop the column `qrcodeType` on the `sims` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "sims" DROP COLUMN "qrcodeType",
ADD COLUMN     "main_region_id" INTEGER,
ADD COLUMN     "qrcode_type" INTEGER;

-- AddForeignKey
ALTER TABLE "sims" ADD CONSTRAINT "sims_main_region_id_fkey" FOREIGN KEY ("main_region_id") REFERENCES "region"("id") ON DELETE SET NULL ON UPDATE CASCADE;
