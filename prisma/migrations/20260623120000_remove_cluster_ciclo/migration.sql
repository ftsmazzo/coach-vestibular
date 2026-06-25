-- Remove legado cluster do ciclo; quiz filtra por escopo N2
ALTER TABLE "LearningCycle" DROP COLUMN IF EXISTS "metaClusterId";
ALTER TABLE "CicloQuiz" DROP COLUMN IF EXISTS "clusterAlvo";
ALTER TABLE "CicloQuiz" ADD COLUMN IF NOT EXISTS "escopoAlvo" TEXT;
