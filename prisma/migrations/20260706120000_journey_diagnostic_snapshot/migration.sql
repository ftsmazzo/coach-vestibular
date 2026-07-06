-- CreateTable
CREATE TABLE "JourneyDiagnosticSnapshot" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "cicloId" TEXT,
    "examId" TEXT,
    "versao" TEXT NOT NULL DEFAULT '1.0',
    "evidenciasJson" TEXT NOT NULL,
    "diagnosticoJson" TEXT NOT NULL,
    "baselineJson" TEXT,
    "mudancasJson" TEXT,
    "narrativaJson" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JourneyDiagnosticSnapshot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "JourneyDiagnosticSnapshot_userId_createdAt_idx" ON "JourneyDiagnosticSnapshot"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "JourneyDiagnosticSnapshot_userId_tipo_idx" ON "JourneyDiagnosticSnapshot"("userId", "tipo");

-- CreateIndex
CREATE INDEX "JourneyDiagnosticSnapshot_tipo_idx" ON "JourneyDiagnosticSnapshot"("tipo");

-- AddForeignKey
ALTER TABLE "JourneyDiagnosticSnapshot" ADD CONSTRAINT "JourneyDiagnosticSnapshot_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
