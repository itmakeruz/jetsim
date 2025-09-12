/*
  Warnings:

  - You are about to drop the column `apn` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `channel_order_id` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `channel_sub_order_id` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `cid` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `coupon` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `customer_code` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `iccid` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `msisdn` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `order_code` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `order_id` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `order_tid` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `outbound_code` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `partner_id` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `pin_1` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `pin_2` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `product_code` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `product_expire_date` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `puk_1` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `puk_2` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `qrcode` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `qrcodeType` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `sale_plan_days` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `sale_plan_name` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `sn_code` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `sn_pin` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `sub_order_id` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `uid` on the `order` table. All the data in the column will be lost.
  - You are about to drop the column `description_en` on the `sims` table. All the data in the column will be lost.
  - You are about to drop the column `description_ru` on the `sims` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `sims` table. All the data in the column will be lost.
  - You are about to drop the column `name_en` on the `sims` table. All the data in the column will be lost.
  - You are about to drop the column `name_ru` on the `sims` table. All the data in the column will be lost.
  - Added the required column `package_id` to the `sims` table without a default value. This is not possible if the table is not empty.
  - Added the required column `user_id` to the `sims` table without a default value. This is not possible if the table is not empty.
  - Changed the type of `status` on the `sims` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "order" DROP CONSTRAINT "order_package_id_fkey";

-- DropForeignKey
ALTER TABLE "order" DROP CONSTRAINT "order_partner_id_fkey";

-- DropIndex
DROP INDEX "order_id_order_tid_order_code_user_id_idx";

-- AlterTable
ALTER TABLE "order" DROP COLUMN "apn",
DROP COLUMN "channel_order_id",
DROP COLUMN "channel_sub_order_id",
DROP COLUMN "cid",
DROP COLUMN "coupon",
DROP COLUMN "customer_code",
DROP COLUMN "iccid",
DROP COLUMN "msisdn",
DROP COLUMN "order_code",
DROP COLUMN "order_id",
DROP COLUMN "order_tid",
DROP COLUMN "outbound_code",
DROP COLUMN "partner_id",
DROP COLUMN "pin_1",
DROP COLUMN "pin_2",
DROP COLUMN "product_code",
DROP COLUMN "product_expire_date",
DROP COLUMN "puk_1",
DROP COLUMN "puk_2",
DROP COLUMN "qrcode",
DROP COLUMN "qrcodeType",
DROP COLUMN "sale_plan_days",
DROP COLUMN "sale_plan_name",
DROP COLUMN "sn_code",
DROP COLUMN "sn_pin",
DROP COLUMN "sub_order_id",
DROP COLUMN "uid",
ALTER COLUMN "package_id" DROP NOT NULL;

-- AlterTable
ALTER TABLE "sims" DROP COLUMN "description_en",
DROP COLUMN "description_ru",
DROP COLUMN "image",
DROP COLUMN "name_en",
DROP COLUMN "name_ru",
ADD COLUMN     "apn" TEXT,
ADD COLUMN     "channel_order_id" TEXT,
ADD COLUMN     "channel_sub_order_id" TEXT,
ADD COLUMN     "cid" TEXT,
ADD COLUMN     "coupon" TEXT,
ADD COLUMN     "customer_code" TEXT,
ADD COLUMN     "iccid" TEXT,
ADD COLUMN     "msisdn" TEXT,
ADD COLUMN     "order_code" TEXT,
ADD COLUMN     "order_id" INTEGER,
ADD COLUMN     "order_tid" TEXT,
ADD COLUMN     "outbound_code" TEXT,
ADD COLUMN     "package_id" INTEGER NOT NULL,
ADD COLUMN     "partner_order_id" TEXT,
ADD COLUMN     "pin_1" TEXT,
ADD COLUMN     "pin_2" TEXT,
ADD COLUMN     "product_code" TEXT,
ADD COLUMN     "product_expire_date" TEXT,
ADD COLUMN     "puk_1" TEXT,
ADD COLUMN     "puk_2" TEXT,
ADD COLUMN     "qrcode" TEXT,
ADD COLUMN     "qrcodeType" INTEGER,
ADD COLUMN     "sale_plan_days" TEXT,
ADD COLUMN     "sale_plan_name" TEXT,
ADD COLUMN     "sn_code" TEXT,
ADD COLUMN     "sn_pin" TEXT,
ADD COLUMN     "sub_order_id" TEXT,
ADD COLUMN     "uid" TEXT,
ADD COLUMN     "user_id" INTEGER NOT NULL,
DROP COLUMN "status",
ADD COLUMN     "status" "OrderStatus" NOT NULL,
ALTER COLUMN "request" DROP NOT NULL,
ALTER COLUMN "response" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "sims" ADD CONSTRAINT "sims_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sims" ADD CONSTRAINT "sims_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "package"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sims" ADD CONSTRAINT "sims_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "package"("id") ON DELETE SET NULL ON UPDATE CASCADE;
