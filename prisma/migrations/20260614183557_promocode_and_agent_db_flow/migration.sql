-- CreateEnum
CREATE TYPE "PromoCodeCreationMode" AS ENUM ('AUTO', 'MANUAL', 'BOTH');

-- CreateEnum
CREATE TYPE "PromoUsageStatus" AS ENUM ('PENDING', 'CONFIRMED', 'CANCELED');

-- CreateEnum
CREATE TYPE "AgentBalanceLedgerType" AS ENUM ('CREDIT');

-- CreateEnum
CREATE TYPE "AgentBalanceLedgerStatus" AS ENUM ('CONFIRMED', 'CANCELED');

-- AlterEnum
ALTER TYPE "UserRoles" ADD VALUE 'AGENT';

-- CreateTable
CREATE TABLE "promo_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "default_client_discount_amount" INTEGER,
    "default_agent_credit_amount" INTEGER,
    "is_agent_creation_enabled" BOOLEAN,
    "agent_creation_mode" "PromoCodeCreationMode",
    "allow_limit_once" BOOLEAN,
    "allow_limit_unlimited" BOOLEAN,
    "allow_limit_custom" BOOLEAN,
    "allow_no_expiry" BOOLEAN,
    "allow_expires_at" BOOLEAN,
    "created_at" TIMESTAMPTZ(5) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(5),

    CONSTRAINT "promo_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_code" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "status" "Status" NOT NULL DEFAULT 'ACTIVE',
    "creation_mode" "PromoCodeCreationMode" NOT NULL,
    "usage_limit" INTEGER,
    "used_count" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMPTZ(5),
    "client_discount_amount" INTEGER NOT NULL,
    "agent_credit_amount" INTEGER NOT NULL DEFAULT 0,
    "agent_id" INTEGER,
    "created_by_staff_id" INTEGER,
    "created_at" TIMESTAMPTZ(5) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(5),

    CONSTRAINT "promo_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "promo_usage" (
    "id" SERIAL NOT NULL,
    "promo_code_id" INTEGER NOT NULL,
    "user_id" INTEGER NOT NULL,
    "transaction_id" INTEGER,
    "order_id" INTEGER,
    "status" "PromoUsageStatus" NOT NULL DEFAULT 'PENDING',
    "discount_amount" INTEGER NOT NULL,
    "agent_credit_amount" INTEGER NOT NULL DEFAULT 0,
    "confirmed_at" TIMESTAMPTZ(5),
    "canceled_at" TIMESTAMPTZ(5),
    "created_at" TIMESTAMPTZ(5) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(5),

    CONSTRAINT "promo_usage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_balance_ledger" (
    "id" SERIAL NOT NULL,
    "agent_id" INTEGER NOT NULL,
    "promo_usage_id" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "type" "AgentBalanceLedgerType" NOT NULL DEFAULT 'CREDIT',
    "status" "AgentBalanceLedgerStatus" NOT NULL DEFAULT 'CONFIRMED',
    "created_at" TIMESTAMPTZ(5) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(5),

    CONSTRAINT "agent_balance_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "promo_code_code_key" ON "promo_code"("code");

-- CreateIndex
CREATE INDEX "promo_code_agent_id_idx" ON "promo_code"("agent_id");

-- CreateIndex
CREATE INDEX "promo_code_status_idx" ON "promo_code"("status");

-- CreateIndex
CREATE UNIQUE INDEX "promo_usage_transaction_id_key" ON "promo_usage"("transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "promo_usage_order_id_key" ON "promo_usage"("order_id");

-- CreateIndex
CREATE INDEX "promo_usage_promo_code_id_idx" ON "promo_usage"("promo_code_id");

-- CreateIndex
CREATE INDEX "promo_usage_user_id_idx" ON "promo_usage"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_balance_ledger_promo_usage_id_key" ON "agent_balance_ledger"("promo_usage_id");

-- CreateIndex
CREATE INDEX "agent_balance_ledger_agent_id_idx" ON "agent_balance_ledger"("agent_id");

-- AddForeignKey
ALTER TABLE "promo_code" ADD CONSTRAINT "promo_code_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code" ADD CONSTRAINT "promo_code_created_by_staff_id_fkey" FOREIGN KEY ("created_by_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_usage" ADD CONSTRAINT "promo_usage_promo_code_id_fkey" FOREIGN KEY ("promo_code_id") REFERENCES "promo_code"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_usage" ADD CONSTRAINT "promo_usage_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_usage" ADD CONSTRAINT "promo_usage_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_usage" ADD CONSTRAINT "promo_usage_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_balance_ledger" ADD CONSTRAINT "agent_balance_ledger_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_balance_ledger" ADD CONSTRAINT "agent_balance_ledger_promo_usage_id_fkey" FOREIGN KEY ("promo_usage_id") REFERENCES "promo_usage"("id") ON DELETE CASCADE ON UPDATE CASCADE;
