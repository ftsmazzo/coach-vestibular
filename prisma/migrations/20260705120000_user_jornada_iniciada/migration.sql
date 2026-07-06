-- AlterTable
ALTER TABLE "User" ADD COLUMN "jornadaIniciadaEm" TIMESTAMP(3);

-- Legado: alunos que já tinham LearningCycle antes do gate de elegibilidade
UPDATE "User" u
SET "jornadaIniciadaEm" = lc."primeiroCiclo"
FROM (
  SELECT "userId", MIN("createdAt") AS "primeiroCiclo"
  FROM "LearningCycle"
  GROUP BY "userId"
) lc
WHERE u.id = lc."userId" AND u."jornadaIniciadaEm" IS NULL;
