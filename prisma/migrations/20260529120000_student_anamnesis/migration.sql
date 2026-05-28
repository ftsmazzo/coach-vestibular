-- CreateEnum
CREATE TYPE "AnamnesisStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED');

-- CreateTable
CREATE TABLE "StudentAnamnesis" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "AnamnesisStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "currentStage" TEXT NOT NULL DEFAULT 'trajetoria',
    "sessionJson" TEXT,
    "structuredProfileJson" TEXT,
    "summary" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StudentAnamnesis_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StudentAnamnesis_userId_key" ON "StudentAnamnesis"("userId");

-- AddForeignKey
ALTER TABLE "StudentAnamnesis" ADD CONSTRAINT "StudentAnamnesis_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
