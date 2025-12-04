/*
  Warnings:

  - You are about to drop the column `request` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `response` on the `order` table. All the data in the column will be lost.
  - You are about to drop the `_region_to_category` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `city` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `error` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `order_job` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `package` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `region_category` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `static_type` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "_region_to_category" DROP CONSTRAINT "_region_to_category_A_fkey";

-- DropForeignKey
ALTER TABLE "_region_to_category" DROP CONSTRAINT "_region_to_category_B_fkey";

-- DropForeignKey
ALTER TABLE "city" DROP CONSTRAINT "city_region_id_fkey";

-- DropForeignKey
ALTER TABLE "tariff" DROP CONSTRAINT "tariff_type_fkey";

-- AlterTable
ALTER TABLE "order" DROP COLUMN "request",
DROP COLUMN "response";

-- AlterTable
ALTER TABLE "region" ADD COLUMN     "regionGroupId" INTEGER;

-- DropTable
DROP TABLE "_region_to_category";

-- DropTable
DROP TABLE "city";

-- DropTable
DROP TABLE "error";

-- DropTable
DROP TABLE "order_job";

-- DropTable
DROP TABLE "package";

-- DropTable
DROP TABLE "region_category";

-- DropTable
DROP TABLE "static_type";

-- CreateTable
CREATE TABLE "region_group" (
    "id" SERIAL NOT NULL,
    "name_ru" TEXT,
    "name_en" TEXT,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "image" TEXT,
    "created_at" TIMESTAMPTZ(5) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(5),

    CONSTRAINT "region_group_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "region" ADD CONSTRAINT "region_regionGroupId_fkey" FOREIGN KEY ("regionGroupId") REFERENCES "region_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;
