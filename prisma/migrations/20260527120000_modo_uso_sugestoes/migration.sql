-- Modo de uso do registro (peso na jornada) + gamificação + sugestões colaborativas

CREATE TYPE "ModoUsoRegistro" AS ENUM ('OFICIAL', 'TREINO', 'REVISAO_PROVA_ANTIGA');

CREATE TYPE "StatusSugestaoClassificacao" AS ENUM ('PENDENTE', 'ACEITA', 'REJEITADA');

ALTER TABLE "Exam" ADD COLUMN "modoUso" "ModoUsoRegistro" NOT NULL DEFAULT 'OFICIAL';

ALTER TABLE "User" ADD COLUMN "xp" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "SugestaoClassificacao" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "examId" TEXT NOT NULL,
    "provaQuestaoId" TEXT,
    "numero" INTEGER NOT NULL,
    "materiaAtual" TEXT NOT NULL,
    "assuntoAtual" TEXT NOT NULL,
    "areaBlocoAtual" TEXT,
    "texto" TEXT NOT NULL,
    "materiaSugerida" TEXT,
    "assuntoSugerido" TEXT,
    "areaBlocoSugerida" TEXT,
    "status" "StatusSugestaoClassificacao" NOT NULL DEFAULT 'PENDENTE',
    "xpConcedido" INTEGER NOT NULL DEFAULT 0,
    "respostaAdmin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "SugestaoClassificacao_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "SugestaoClassificacao_status_idx" ON "SugestaoClassificacao"("status");
CREATE INDEX "SugestaoClassificacao_userId_idx" ON "SugestaoClassificacao"("userId");
CREATE INDEX "SugestaoClassificacao_examId_idx" ON "SugestaoClassificacao"("examId");

ALTER TABLE "SugestaoClassificacao" ADD CONSTRAINT "SugestaoClassificacao_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SugestaoClassificacao" ADD CONSTRAINT "SugestaoClassificacao_examId_fkey" FOREIGN KEY ("examId") REFERENCES "Exam"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "SugestaoClassificacao" ADD CONSTRAINT "SugestaoClassificacao_provaQuestaoId_fkey" FOREIGN KEY ("provaQuestaoId") REFERENCES "ProvaQuestao"("id") ON DELETE SET NULL ON UPDATE CASCADE;
