/*
  Warnings:

  - The `type` column on the `tariff` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - You are about to drop the `StaticTypes` table. If the table is not empty, all the data it contains will be lost.

*/
-- AlterTable
ALTER TABLE "tariff" DROP COLUMN "type",
ADD COLUMN     "type" INTEGER;

-- DropTable
DROP TABLE "StaticTypes";

-- CreateTable
CREATE TABLE "static_type" (
    "id" SERIAL NOT NULL,
    "identification_number" INTEGER,
    "name_uz" TEXT,
    "name_ru" TEXT,
    "created_at" TIMESTAMPTZ(5) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(5) NOT NULL,

    CONSTRAINT "static_type_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "tariff" ADD CONSTRAINT "tariff_type_fkey" FOREIGN KEY ("type") REFERENCES "static_type"("id") ON DELETE SET NULL ON UPDATE CASCADE;
