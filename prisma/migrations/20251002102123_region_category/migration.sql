-- DropForeignKey
ALTER TABLE "region" DROP CONSTRAINT "region_region_category_fkey";

-- AlterTable
ALTER TABLE "region" ADD COLUMN     "regionCategoryId" INTEGER;

-- AlterTable
ALTER TABLE "region_category" ADD COLUMN     "regionId" INTEGER;

-- CreateTable
CREATE TABLE "_region_to_category" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_region_to_category_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_region_to_category_B_index" ON "_region_to_category"("B");

-- AddForeignKey
ALTER TABLE "_region_to_category" ADD CONSTRAINT "_region_to_category_A_fkey" FOREIGN KEY ("A") REFERENCES "region"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_region_to_category" ADD CONSTRAINT "_region_to_category_B_fkey" FOREIGN KEY ("B") REFERENCES "region_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;
