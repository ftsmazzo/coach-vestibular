-- CreateTable
CREATE TABLE "UserXpEvent" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "referencia" TEXT NOT NULL,
    "pontos" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserXpEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserXpEvent_userId_tipo_referencia_key" ON "UserXpEvent"("userId", "tipo", "referencia");

-- CreateIndex
CREATE INDEX "UserXpEvent_userId_createdAt_idx" ON "UserXpEvent"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "UserXpEvent" ADD CONSTRAINT "UserXpEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
