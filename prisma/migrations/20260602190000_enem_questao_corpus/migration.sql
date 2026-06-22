-- Corpus estrutural ENEM (enem.dev)
CREATE TYPE "EnemDisciplina" AS ENUM ('linguagens', 'ciencias_humanas', 'ciencias_natureza', 'matematica');
CREATE TYPE "EnemIdiomaCorpus" AS ENUM ('COMUM', 'ingles', 'espanhol');

CREATE TABLE "EnemQuestaoCorpus" (
    "id" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "numero" INTEGER NOT NULL,
    "idioma" "EnemIdiomaCorpus" NOT NULL DEFAULT 'COMUM',
    "dia" INTEGER NOT NULL,
    "disciplina" "EnemDisciplina" NOT NULL,
    "titulo" TEXT,
    "enunciadoMd" TEXT,
    "introducaoAlternativas" TEXT,
    "alternativas" JSONB NOT NULL,
    "gabarito" TEXT NOT NULL,
    "arquivos" JSONB,
    "fonteId" TEXT NOT NULL,
    "fonte" TEXT NOT NULL DEFAULT 'enem.dev',
    "importadoEm" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "atualizadoEm" TIMESTAMP(3) NOT NULL,
    "areaBloco" TEXT,
    "materia" TEXT,
    "assunto" TEXT,
    "conhecimentoDominioId" TEXT,
    "conhecimentoEscopoId" TEXT,
    "conhecimentoExigido" TEXT,
    "classificacaoVersao" TEXT,
    "classificacaoConfianca" DOUBLE PRECISION,
    "provaQuestaoId" TEXT,

    CONSTRAINT "EnemQuestaoCorpus_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EnemQuestaoCorpus_fonteId_key" ON "EnemQuestaoCorpus"("fonteId");
CREATE UNIQUE INDEX "EnemQuestaoCorpus_provaQuestaoId_key" ON "EnemQuestaoCorpus"("provaQuestaoId");
CREATE UNIQUE INDEX "EnemQuestaoCorpus_ano_numero_idioma_key" ON "EnemQuestaoCorpus"("ano", "numero", "idioma");
CREATE INDEX "EnemQuestaoCorpus_ano_disciplina_idx" ON "EnemQuestaoCorpus"("ano", "disciplina");
CREATE INDEX "EnemQuestaoCorpus_conhecimentoEscopoId_idx" ON "EnemQuestaoCorpus"("conhecimentoEscopoId");
