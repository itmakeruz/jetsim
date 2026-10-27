ALTER TABLE "sims" ADD COLUMN "usage_snapshot" JSONB, ADD COLUMN "usage_checked_at" TIMESTAMPTZ(5);
CREATE INDEX "sims_partner_id_channel_order_id_idx" ON "sims"("partner_id", "channel_order_id");
