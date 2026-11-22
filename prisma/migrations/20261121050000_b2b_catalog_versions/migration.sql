CREATE SEQUENCE catalog_offer_revision_seq START 2;
ALTER TABLE tariff ADD COLUMN offer_revision BIGINT NOT NULL DEFAULT 1;
ALTER TABLE reseller_tariff ADD COLUMN offer_revision BIGINT NOT NULL DEFAULT 1;
ALTER TABLE reseller_order ADD COLUMN offer_version TEXT, ADD COLUMN offer_payload JSONB;
-- All offer mutations and version-aware reservation share a transaction lock.
CREATE FUNCTION catalog_revision() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(71025,71025);
  IF TG_OP = 'INSERT' THEN
    NEW.offer_revision := nextval('catalog_offer_revision_seq');
  ELSIF TG_TABLE_NAME = 'tariff' THEN
    IF (to_jsonb(NEW) - ARRAY['offer_revision','updated_at','name_ru','name_en','title_ru','title_en','is_popular','hide_site','price_sell','price_arrival','cashback_percent']) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['offer_revision','updated_at','name_ru','name_en','title_ru','title_en','is_popular','hide_site','price_sell','price_arrival','cashback_percent']) THEN
      NEW.offer_revision := nextval('catalog_offer_revision_seq');
    END IF;
  ELSIF NEW.active IS DISTINCT FROM OLD.active THEN
    NEW.offer_revision := nextval('catalog_offer_revision_seq');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER tariff_offer_revision BEFORE INSERT OR UPDATE ON tariff FOR EACH ROW EXECUTE FUNCTION catalog_revision();
CREATE TRIGGER reseller_offer_revision BEFORE INSERT OR UPDATE ON reseller_tariff FOR EACH ROW EXECUTE FUNCTION catalog_revision();
CREATE FUNCTION catalog_coverage_revision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target_id integer;
BEGIN
  PERFORM pg_advisory_xact_lock(71025,71025);
  IF TG_TABLE_NAME = '_tariff_regions' THEN
    IF TG_OP <> 'INSERT' THEN UPDATE tariff SET offer_revision = nextval('catalog_offer_revision_seq') WHERE id = OLD."B"; END IF;
    IF TG_OP <> 'DELETE' THEN UPDATE tariff SET offer_revision = nextval('catalog_offer_revision_seq') WHERE id = NEW."B"; END IF;
  ELSIF TG_TABLE_NAME = '_region_to_regiongroup' THEN
    IF TG_OP <> 'INSERT' THEN UPDATE tariff SET offer_revision = nextval('catalog_offer_revision_seq') WHERE region_group_id = OLD."B"; END IF;
    IF TG_OP <> 'DELETE' THEN UPDATE tariff SET offer_revision = nextval('catalog_offer_revision_seq') WHERE region_group_id = NEW."B"; END IF;
  ELSIF TG_TABLE_NAME = 'reseller' THEN
    IF NEW.status IS DISTINCT FROM OLD.status THEN UPDATE reseller_tariff SET offer_revision = nextval('catalog_offer_revision_seq') WHERE reseller_id = NEW.id; END IF;
  ELSIF TG_TABLE_NAME = 'partner' THEN
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.identified_number IS DISTINCT FROM OLD.identified_number THEN UPDATE tariff SET offer_revision = nextval('catalog_offer_revision_seq') WHERE partner_id = NEW.id; END IF;
  ELSIF TG_TABLE_NAME = 'region' THEN
    IF NEW.status IS DISTINCT FROM OLD.status OR NEW.iso_code IS DISTINCT FROM OLD.iso_code THEN
      UPDATE tariff SET offer_revision = nextval('catalog_offer_revision_seq') WHERE id IN (SELECT "B" FROM "_tariff_regions" WHERE "A" = NEW.id) OR region_group_id IN (SELECT "B" FROM "_region_to_regiongroup" WHERE "A" = NEW.id);
    END IF;
  ELSIF TG_TABLE_NAME = 'region_group' AND NEW.status IS DISTINCT FROM OLD.status THEN
    UPDATE tariff SET offer_revision = nextval('catalog_offer_revision_seq') WHERE region_group_id = NEW.id;
  END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER coverage_offer_revision AFTER INSERT OR UPDATE OR DELETE ON "_tariff_regions" FOR EACH ROW EXECUTE FUNCTION catalog_coverage_revision();
CREATE TRIGGER group_coverage_offer_revision AFTER INSERT OR UPDATE OR DELETE ON "_region_to_regiongroup" FOR EACH ROW EXECUTE FUNCTION catalog_coverage_revision();
CREATE TRIGGER region_offer_revision AFTER UPDATE ON region FOR EACH ROW EXECUTE FUNCTION catalog_coverage_revision();
CREATE TRIGGER group_offer_revision AFTER UPDATE ON region_group FOR EACH ROW EXECUTE FUNCTION catalog_coverage_revision();
CREATE TRIGGER company_offer_revision AFTER UPDATE ON reseller FOR EACH ROW EXECUTE FUNCTION catalog_coverage_revision();
CREATE TRIGGER provider_offer_revision AFTER UPDATE ON partner FOR EACH ROW EXECUTE FUNCTION catalog_coverage_revision();
