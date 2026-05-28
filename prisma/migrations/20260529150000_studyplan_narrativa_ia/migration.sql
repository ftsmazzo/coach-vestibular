-- AlterTable
ALTER TABLE "StudyPlan" ADD COLUMN "narrativeJson" TEXT;
ALTER TABLE "StudyPlan" ADD COLUMN "fonteGeracao" TEXT DEFAULT 'template';
