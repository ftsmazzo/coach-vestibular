-- CreateEnum
CREATE TYPE "FeedbackTipo" AS ENUM ('BUG', 'SUGESTAO', 'DUVIDA');

-- CreateEnum
CREATE TYPE "FeedbackStatus" AS ENUM ('NOVO', 'EM_ANALISE', 'RESOLVIDO', 'ARQUIVADO');

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" "FeedbackTipo" NOT NULL DEFAULT 'BUG',
    "status" "FeedbackStatus" NOT NULL DEFAULT 'NOVO',
    "titulo" TEXT NOT NULL,
    "descricao" TEXT NOT NULL,
    "esperado" TEXT,
    "severidade" TEXT,
    "pagina" TEXT,
    "contextoJson" TEXT,
    "anexoPath" TEXT,
    "anexoFileName" TEXT,
    "anexoMimeType" TEXT,
    "notaAdmin" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Feedback_status_createdAt_idx" ON "Feedback"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Feedback_tipo_idx" ON "Feedback"("tipo");

-- AddForeignKey
ALTER TABLE "Feedback" ADD CONSTRAINT "Feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
