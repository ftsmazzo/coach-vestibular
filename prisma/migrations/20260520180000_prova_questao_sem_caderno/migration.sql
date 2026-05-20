-- Metadados da prova (nome, ano, caderno, banca) ficam só em Prova

ALTER TABLE "ProvaQuestao" ADD COLUMN "areaBloco" TEXT;

ALTER TABLE "ProvaQuestao" DROP COLUMN "caderno";
