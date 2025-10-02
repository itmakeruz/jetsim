-- AlterTable
ALTER TABLE "region" ADD COLUMN     "region_category" INTEGER;

-- CreateTable
CREATE TABLE "region_category" (
    "id" SERIAL NOT NULL,
    "name_ru" TEXT,
    "name_en" TEXT,
    "icon" TEXT,
    "created_at" TIMESTAMPTZ(5) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(5),

    CONSTRAINT "region_category_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "region" ADD CONSTRAINT "region_region_category_fkey" FOREIGN KEY ("region_category") REFERENCES "region_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;
