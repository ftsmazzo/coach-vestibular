-- CreateEnum
CREATE TYPE "CicloStatus" AS ENUM ('ATIVO', 'FECHADO');

-- AlterTable
ALTER TABLE "Quest" ADD COLUMN "cicloId" TEXT;

-- CreateTable
CREATE TABLE "LearningCycle" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "indice" INTEGER NOT NULL DEFAULT 1,
    "status" "CicloStatus" NOT NULL DEFAULT 'ATIVO',
    "startAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endAt" TIMESTAMP(3) NOT NULL,
    "metaClusterId" TEXT,
    "metaMateria" TEXT,
    "metaTitulo" TEXT NOT NULL,
    "baselineJson" TEXT,
    "resultadoJson" TEXT,
    "fechadoEm" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LearningCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CicloQuiz" (
    "id" TEXT NOT NULL,
    "cicloId" TEXT NOT NULL,
    "clusterAlvo" TEXT,
    "materiaAlvo" TEXT,
    "itemsJson" TEXT NOT NULL,
    "respostasJson" TEXT,
    "totalQuestoes" INTEGER NOT NULL DEFAULT 0,
    "pctAcerto" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'EM_ABERTO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "CicloQuiz_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Quest_cicloId_idx" ON "Quest"("cicloId");

-- CreateIndex
CREATE INDEX "LearningCycle_userId_status_idx" ON "LearningCycle"("userId", "status");

-- CreateIndex
CREATE INDEX "CicloQuiz_cicloId_idx" ON "CicloQuiz"("cicloId");

-- AddForeignKey
ALTER TABLE "Quest" ADD CONSTRAINT "Quest_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "LearningCycle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LearningCycle" ADD CONSTRAINT "LearningCycle_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CicloQuiz" ADD CONSTRAINT "CicloQuiz_cicloId_fkey" FOREIGN KEY ("cicloId") REFERENCES "LearningCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;
