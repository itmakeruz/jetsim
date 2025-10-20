-- CreateTable
CREATE TABLE "faqs" (
    "id" SERIAL NOT NULL,
    "question_ru" TEXT,
    "question_en" TEXT,
    "answer_ru" TEXT,
    "answer_en" TEXT,
    "created_at" TIMESTAMPTZ(5) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(5) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);
