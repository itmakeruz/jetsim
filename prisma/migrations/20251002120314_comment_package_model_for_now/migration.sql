/*
  Warnings:

  - You are about to drop the column `packageId` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `package_id` on the `sims` table. All the data in the column will be lost.
  - You are about to drop the `package` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `tariff_id` to the `sims` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "order" DROP CONSTRAINT "order_packageId_fkey";

-- DropForeignKey
ALTER TABLE "sims" DROP CONSTRAINT "sims_package_id_fkey";

-- AlterTable
ALTER TABLE "order" DROP COLUMN "packageId";

-- AlterTable
ALTER TABLE "sims" DROP COLUMN "package_id",
ADD COLUMN     "tariff_id" INTEGER NOT NULL;

-- DropTable
DROP TABLE "package";

-- AddForeignKey
ALTER TABLE "sims" ADD CONSTRAINT "sims_tariff_id_fkey" FOREIGN KEY ("tariff_id") REFERENCES "tariff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
