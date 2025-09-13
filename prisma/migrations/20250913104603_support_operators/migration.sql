-- CreateEnum
CREATE TYPE "UserRoles" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'PRE_ACCOUNTANT');

-- AlterTable
ALTER TABLE "staff" ADD COLUMN     "role" "UserRoles";

-- CreateTable
CREATE TABLE "support_operator" (
    "id" SERIAL NOT NULL,
    "name" TEXT,
    "login" TEXT,
    "password" TEXT,
    "status" "Status" DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(5) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(5),

    CONSTRAINT "support_operator_pkey" PRIMARY KEY ("id")
);
