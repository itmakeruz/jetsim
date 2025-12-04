/*
  Warnings:

  - You are about to drop the column `regionGroupId` on the `region` table. All the data in the column will be lost.

*/
-- DropForeignKey
ALTER TABLE "region" DROP CONSTRAINT "region_regionGroupId_fkey";

-- AlterTable
ALTER TABLE "region" DROP COLUMN "regionGroupId";

-- CreateTable
CREATE TABLE "_region_to_regiongroup" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_region_to_regiongroup_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE INDEX "_region_to_regiongroup_B_index" ON "_region_to_regiongroup"("B");

-- AddForeignKey
ALTER TABLE "_region_to_regiongroup" ADD CONSTRAINT "_region_to_regiongroup_A_fkey" FOREIGN KEY ("A") REFERENCES "region"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_region_to_regiongroup" ADD CONSTRAINT "_region_to_regiongroup_B_fkey" FOREIGN KEY ("B") REFERENCES "region_group"("id") ON DELETE CASCADE ON UPDATE CASCADE;
