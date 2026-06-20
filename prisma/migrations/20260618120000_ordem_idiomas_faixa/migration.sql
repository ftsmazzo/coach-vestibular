-- CreateEnum
CREATE TYPE "OrdemIdiomasFaixa" AS ENUM ('INGLES_PRIMEIRO', 'ESPANHOL_PRIMEIRO');

-- AlterTable
ALTER TABLE "Prova" ADD COLUMN "ordemIdiomasFaixa" "OrdemIdiomasFaixa" NOT NULL DEFAULT 'INGLES_PRIMEIRO';
