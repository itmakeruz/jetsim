-- CreateTable
CREATE TABLE "order_events" (
    "id" SERIAL NOT NULL,
    "order_id" INTEGER NOT NULL,
    "sim_id" INTEGER,
    "partner_id" INTEGER,
    "event" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "message" TEXT,
    "meta" JSONB,
    "created_at" TIMESTAMPTZ(5) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "order_events_order_id_idx" ON "order_events"("order_id");

-- CreateIndex
CREATE INDEX "order_events_sim_id_idx" ON "order_events"("sim_id");

-- CreateIndex
CREATE INDEX "order_events_created_at_idx" ON "order_events"("created_at");

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_sim_id_fkey" FOREIGN KEY ("sim_id") REFERENCES "sims"("id") ON DELETE SET NULL ON UPDATE CASCADE;

