-- CreateEnum
CREATE TYPE "IdiomaVarianteQuestao" AS ENUM ('COMUM', 'INGLES', 'ESPANHOL');
CREATE TYPE "PoliticaIdiomasProva" AS ENUM ('NENHUMA', 'DUPLICATA_EN_ES');

-- AlterTable
ALTER TABLE "Prova" ADD COLUMN "politicaIdiomas" "PoliticaIdiomasProva" NOT NULL DEFAULT 'NENHUMA';
ALTER TABLE "Prova" ADD COLUMN "idiomaQuestaoInicio" INTEGER;
ALTER TABLE "Prova" ADD COLUMN "idiomaQuestaoFim" INTEGER;

ALTER TABLE "ProvaQuestao" ADD COLUMN "idiomaVariante" "IdiomaVarianteQuestao" NOT NULL DEFAULT 'COMUM';

ALTER TABLE "Exam" ADD COLUMN "idiomaEstrangeiro" "IdiomaVarianteQuestao";

-- DropIndex
DROP INDEX "ProvaQuestao_provaId_numero_key";

-- CreateIndex
CREATE UNIQUE INDEX "ProvaQuestao_provaId_numero_idiomaVariante_key" ON "ProvaQuestao"("provaId", "numero", "idiomaVariante");
