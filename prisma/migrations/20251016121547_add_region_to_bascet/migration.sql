-- AddForeignKey
ALTER TABLE "basket_item" ADD CONSTRAINT "basket_item_region_id_fkey" FOREIGN KEY ("region_id") REFERENCES "region"("id") ON DELETE SET NULL ON UPDATE CASCADE;
