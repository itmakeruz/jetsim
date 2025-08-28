-- AlterTable
ALTER TABLE "order" ADD COLUMN     "apn" TEXT,
ADD COLUMN     "channel_order_id" TEXT,
ADD COLUMN     "channel_sub_order_id" TEXT,
ADD COLUMN     "iccid" TEXT,
ADD COLUMN     "msisdn" TEXT,
ADD COLUMN     "order_id" TEXT,
ADD COLUMN     "sub_order_id" TEXT,
ADD COLUMN     "uid" TEXT;
