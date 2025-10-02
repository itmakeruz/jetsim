-- CreateTable
CREATE TABLE "package" (
    "id" SERIAL NOT NULL,
    "sms_count" INTEGER,
    "minutes_count" INTEGER,
    "mb_count" INTEGER,
    "sku_id" TEXT NOT NULL,
    "status" "Status" NOT NULL,
    "cost" INTEGER,
    "comission" INTEGER,
    "tariff_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(5) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(5),

    CONSTRAINT "package_pkey" PRIMARY KEY ("id")
);
