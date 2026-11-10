ALTER TABLE "reseller_order" ADD COLUMN "cost_kopecks" BIGINT,
ADD COLUMN "cost_currency" TEXT,
ADD COLUMN "provider_name" TEXT;
-- Исторические расходы неизвестны: не подменяем их текущей ценой поставщика.
