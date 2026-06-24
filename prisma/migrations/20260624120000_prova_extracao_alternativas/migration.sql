-- AlterTable
ALTER TABLE "Prova" ADD COLUMN "extracaoValidada" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "ProvaQuestao" ADD COLUMN "alternativas" TEXT;
