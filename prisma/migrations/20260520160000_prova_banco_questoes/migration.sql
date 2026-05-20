-- CreateEnum
CREATE TYPE "ProvaTipo" AS ENUM ('ENEM_OFICIAL', 'SIMULADO', 'VESTIBULAR', 'OUTRO');

-- CreateTable
CREATE TABLE "Prova" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "banca" TEXT NOT NULL DEFAULT 'ENEM',
    "tipo" "ProvaTipo" NOT NULL DEFAULT 'SIMULADO',
    "ano" INTEGER,
    "dia" INTEGER,
    "caderno" TEXT,
    "descricao" TEXT,
    "totalQuestoes" INTEGER NOT NULL,
    "publicada" BOOLEAN NOT NULL DEFAULT false,
    "gabaritoCompleto" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Prova_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProvaQuestao" (
    "id" TEXT NOT NULL,
    "provaId" TEXT NOT NULL,
    "numero" INTEGER NOT NULL,
    "caderno" TEXT,
    "materia" TEXT NOT NULL,
    "assunto" TEXT NOT NULL,
    "conhecimentoExigido" TEXT,
    "gabarito" TEXT,

    CONSTRAINT "ProvaQuestao_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Exam" ADD COLUMN "provaId" TEXT;

-- AlterTable
ALTER TABLE "QuestionAttempt" ADD COLUMN "provaQuestaoId" TEXT;
ALTER TABLE "QuestionAttempt" ADD COLUMN "respostaAluno" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "ProvaQuestao_provaId_numero_key" ON "ProvaQuestao"("provaId", "numero");
CREATE INDEX "ProvaQuestao_provaId_materia_idx" ON "ProvaQuestao"("provaId", "materia");

-- AddForeignKey
ALTER TABLE "ProvaQuestao" ADD CONSTRAINT "ProvaQuestao_provaId_fkey" FOREIGN KEY ("provaId") REFERENCES "Prova"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Exam" ADD CONSTRAINT "Exam_provaId_fkey" FOREIGN KEY ("provaId") REFERENCES "Prova"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "QuestionAttempt" ADD CONSTRAINT "QuestionAttempt_provaQuestaoId_fkey" FOREIGN KEY ("provaQuestaoId") REFERENCES "ProvaQuestao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
