-- Classificação N2 em ProvaQuestao (paridade com EnemQuestaoCorpus)
ALTER TABLE "ProvaQuestao" ADD COLUMN "conhecimentoDominioId" TEXT;
ALTER TABLE "ProvaQuestao" ADD COLUMN "conhecimentoEscopoId" TEXT;
ALTER TABLE "ProvaQuestao" ADD COLUMN "classificacaoVersao" TEXT;
ALTER TABLE "ProvaQuestao" ADD COLUMN "classificacaoConfianca" DOUBLE PRECISION;
ALTER TABLE "ProvaQuestao" ADD COLUMN "classificacaoSecundariosJson" TEXT;
ALTER TABLE "ProvaQuestao" ADD COLUMN "conceitosCanonicosJson" TEXT;

CREATE INDEX "ProvaQuestao_conhecimentoEscopoId_idx" ON "ProvaQuestao"("conhecimentoEscopoId");
