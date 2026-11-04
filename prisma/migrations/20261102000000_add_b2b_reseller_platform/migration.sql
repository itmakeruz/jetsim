-- CreateEnum
CREATE TYPE "ResellerStatus" AS ENUM ('ACTIVE', 'BLOCKED');

-- CreateEnum
CREATE TYPE "ResellerKeyStatus" AS ENUM ('ACTIVE', 'REVOKED');

-- CreateEnum
CREATE TYPE "ResellerLedgerType" AS ENUM ('TOPUP', 'ADJUSTMENT', 'RESERVE', 'RELEASE', 'CAPTURE', 'REFUND');

-- CreateEnum
CREATE TYPE "ResellerOrderState" AS ENUM ('RESERVED', 'SUBMITTING', 'SUBMITTED', 'ISSUED', 'FAILED', 'RECONCILE', 'CANCELLED', 'REFUNDED');

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "is_service" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "sims" ADD COLUMN     "reseller_order_id" INTEGER;

-- AlterTable
ALTER TABLE "order" ADD COLUMN     "reseller_order_id" INTEGER;

-- CreateTable
CREATE TABLE "reseller" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "status" "ResellerStatus" NOT NULL DEFAULT 'ACTIVE',
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "service_user_id" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(5) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(5),

    CONSTRAINT "reseller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reseller_api_key" (
    "id" SERIAL NOT NULL,
    "reseller_id" INTEGER NOT NULL,
    "name" TEXT,
    "prefix" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "status" "ResellerKeyStatus" NOT NULL DEFAULT 'ACTIVE',
    "last_used_at" TIMESTAMPTZ(5),
    "revoked_at" TIMESTAMPTZ(5),
    "created_at" TIMESTAMPTZ(5) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reseller_api_key_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reseller_tariff" (
    "id" SERIAL NOT NULL,
    "reseller_id" INTEGER NOT NULL,
    "tariff_id" INTEGER NOT NULL,
    "price_kopecks" BIGINT NOT NULL,
    "price_version" INTEGER NOT NULL DEFAULT 1,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(5) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(5),

    CONSTRAINT "reseller_tariff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reseller_account" (
    "reseller_id" INTEGER NOT NULL,
    "balance_kopecks" BIGINT NOT NULL DEFAULT 0,
    "reserved_kopecks" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ(5),

    CONSTRAINT "reseller_account_pkey" PRIMARY KEY ("reseller_id")
);

-- CreateTable
CREATE TABLE "reseller_ledger" (
    "id" SERIAL NOT NULL,
    "reseller_id" INTEGER NOT NULL,
    "type" "ResellerLedgerType" NOT NULL,
    "delta_balance_kopecks" BIGINT NOT NULL,
    "delta_reserved_kopecks" BIGINT NOT NULL,
    "balance_after" BIGINT NOT NULL,
    "reserved_after" BIGINT NOT NULL,
    "reseller_order_id" INTEGER,
    "comment" TEXT,
    "actor" TEXT,
    "idempotency_key" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(5) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reseller_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reseller_order" (
    "id" SERIAL NOT NULL,
    "reseller_id" INTEGER NOT NULL,
    "client_order_id" TEXT NOT NULL,
    "request_hash" TEXT NOT NULL,
    "state" "ResellerOrderState" NOT NULL DEFAULT 'RESERVED',
    "state_reason" TEXT,
    "tariff_id" INTEGER NOT NULL,
    "tariff_name_ru" TEXT NOT NULL,
    "tariff_name_en" TEXT NOT NULL,
    "data_gb" INTEGER,
    "validity_days" INTEGER,
    "price_kopecks" BIGINT NOT NULL,
    "price_version" INTEGER NOT NULL,
    "source" TEXT,
    "source_ref" TEXT,
    "provider_response" JSONB,
    "submitting_at" TIMESTAMPTZ(5),
    "submitted_at" TIMESTAMPTZ(5),
    "issued_at" TIMESTAMPTZ(5),
    "failed_at" TIMESTAMPTZ(5),
    "created_at" TIMESTAMPTZ(5) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(5),

    CONSTRAINT "reseller_order_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "reseller_service_user_id_key" ON "reseller"("service_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "reseller_api_key_prefix_key" ON "reseller_api_key"("prefix");

-- CreateIndex
CREATE INDEX "reseller_api_key_reseller_id_idx" ON "reseller_api_key"("reseller_id");

-- CreateIndex
CREATE UNIQUE INDEX "reseller_tariff_reseller_id_tariff_id_key" ON "reseller_tariff"("reseller_id", "tariff_id");

-- CreateIndex
CREATE INDEX "reseller_ledger_reseller_id_id_idx" ON "reseller_ledger"("reseller_id", "id");

-- CreateIndex
CREATE INDEX "reseller_ledger_reseller_order_id_idx" ON "reseller_ledger"("reseller_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "reseller_ledger_reseller_id_idempotency_key_key" ON "reseller_ledger"("reseller_id", "idempotency_key");

-- CreateIndex
CREATE INDEX "reseller_order_state_idx" ON "reseller_order"("state");

-- CreateIndex
CREATE INDEX "reseller_order_reseller_id_updated_at_idx" ON "reseller_order"("reseller_id", "updated_at");

-- CreateIndex
CREATE UNIQUE INDEX "reseller_order_reseller_id_client_order_id_key" ON "reseller_order"("reseller_id", "client_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "sims_reseller_order_id_key" ON "sims"("reseller_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "order_reseller_order_id_key" ON "order"("reseller_order_id");

-- AddForeignKey
ALTER TABLE "sims" ADD CONSTRAINT "sims_reseller_order_id_fkey" FOREIGN KEY ("reseller_order_id") REFERENCES "reseller_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order" ADD CONSTRAINT "order_reseller_order_id_fkey" FOREIGN KEY ("reseller_order_id") REFERENCES "reseller_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller" ADD CONSTRAINT "reseller_service_user_id_fkey" FOREIGN KEY ("service_user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_api_key" ADD CONSTRAINT "reseller_api_key_reseller_id_fkey" FOREIGN KEY ("reseller_id") REFERENCES "reseller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_tariff" ADD CONSTRAINT "reseller_tariff_reseller_id_fkey" FOREIGN KEY ("reseller_id") REFERENCES "reseller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_tariff" ADD CONSTRAINT "reseller_tariff_tariff_id_fkey" FOREIGN KEY ("tariff_id") REFERENCES "tariff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_account" ADD CONSTRAINT "reseller_account_reseller_id_fkey" FOREIGN KEY ("reseller_id") REFERENCES "reseller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_ledger" ADD CONSTRAINT "reseller_ledger_reseller_id_fkey" FOREIGN KEY ("reseller_id") REFERENCES "reseller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_ledger" ADD CONSTRAINT "reseller_ledger_reseller_order_id_fkey" FOREIGN KEY ("reseller_order_id") REFERENCES "reseller_order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_order" ADD CONSTRAINT "reseller_order_reseller_id_fkey" FOREIGN KEY ("reseller_id") REFERENCES "reseller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reseller_order" ADD CONSTRAINT "reseller_order_tariff_id_fkey" FOREIGN KEY ("tariff_id") REFERENCES "tariff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ---------------------------------------------------------------------------
-- Ограничения, которые Prisma не описывает (страховка поверх логики приложения)
-- ---------------------------------------------------------------------------

-- Баланс и резерв не могут стать отрицательными, доступная сумма (balance - reserved) — тоже.
ALTER TABLE "reseller_account"
  ADD CONSTRAINT "reseller_account_non_negative"
  CHECK ("reserved_kopecks" >= 0 AND "balance_kopecks" >= 0 AND ("balance_kopecks" - "reserved_kopecks") >= 0);

-- Цена тарифа компании — неотрицательная.
ALTER TABLE "reseller_tariff"
  ADD CONSTRAINT "reseller_tariff_price_non_negative" CHECK ("price_kopecks" >= 0);

-- Финансовый журнал неизменяем: запрещаем UPDATE и DELETE.
CREATE OR REPLACE FUNCTION "reseller_ledger_immutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'reseller_ledger is append-only (% is not allowed)', TG_OP;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "reseller_ledger_no_update_delete"
  BEFORE UPDATE OR DELETE ON "reseller_ledger"
  FOR EACH ROW EXECUTE FUNCTION "reseller_ledger_immutable"();
