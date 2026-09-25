-- CreateIndex
CREATE INDEX "user_email_idx" ON "user"("email");

-- CreateIndex
CREATE INDEX "user_phone_number_idx" ON "user"("phone_number");

-- CreateIndex
CREATE INDEX "sims_iccid_idx" ON "sims"("iccid");

-- CreateIndex
CREATE INDEX "sims_order_id_idx" ON "sims"("order_id");

-- CreateIndex
CREATE INDEX "sims_user_id_idx" ON "sims"("user_id");

-- CreateIndex
CREATE INDEX "sims_status_idx" ON "sims"("status");

-- CreateIndex
CREATE INDEX "sims_created_at_idx" ON "sims"("created_at");

-- CreateIndex
CREATE INDEX "order_status_idx" ON "order"("status");

-- CreateIndex
CREATE INDEX "order_user_id_idx" ON "order"("user_id");

-- CreateIndex
CREATE INDEX "order_created_at_idx" ON "order"("created_at");
