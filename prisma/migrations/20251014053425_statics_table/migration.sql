-- CreateTable
CREATE TABLE "StaticTypes" (
    "id" SERIAL NOT NULL,
    "identification_number" INTEGER,
    "name_uz" TEXT,
    "name_ru" TEXT,
    "created_at" TIMESTAMPTZ(5) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(5) NOT NULL,

    CONSTRAINT "StaticTypes_pkey" PRIMARY KEY ("id")
);
