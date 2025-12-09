-- CreateEnum
CREATE TYPE "SimStatus" AS ENUM ('ACTIVATED', 'EXPIRED');

-- AlterTable
ALTER TABLE "sims" ADD COLUMN     "partner_sim_status" INTEGER,
ADD COLUMN     "sim_status" "SimStatus";
