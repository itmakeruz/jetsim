-- Валюта партнёрской компании: RUB или USD. Суммы — минорные единицы (копейки/центы).
ALTER TABLE "reseller" ADD CONSTRAINT "reseller_currency_check" CHECK ("currency" IN ('RUB', 'USD'));

-- Валюта фиксируется в заказе вместе с ценой
ALTER TABLE "reseller_order" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'RUB';
ALTER TABLE "reseller_order" ADD CONSTRAINT "reseller_order_currency_check" CHECK ("currency" IN ('RUB', 'USD'));
UPDATE "reseller_order" o SET "currency" = r."currency" FROM "reseller" r WHERE r."id" = o."reseller_id";

-- Валюту нельзя менять: баланс, журнал и цены уже выражены в ней
CREATE OR REPLACE FUNCTION "reseller_currency_immutable"() RETURNS trigger AS $$
BEGIN
  IF NEW."currency" IS DISTINCT FROM OLD."currency" THEN
    RAISE EXCEPTION 'reseller.currency is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "reseller_currency_no_change"
  BEFORE UPDATE ON "reseller"
  FOR EACH ROW EXECUTE FUNCTION "reseller_currency_immutable"();
