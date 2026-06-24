-- Motor de aprendizagem v1: snapshot pedagógico em QuestionAttempt, rastreabilidade em Quest e LearningCycle

ALTER TABLE "QuestionAttempt" ADD COLUMN IF NOT EXISTS "conhecimentoDominioId" TEXT;
ALTER TABLE "QuestionAttempt" ADD COLUMN IF NOT EXISTS "conhecimentoEscopoId" TEXT;
ALTER TABLE "QuestionAttempt" ADD COLUMN IF NOT EXISTS "conhecimentoExigido" TEXT;
ALTER TABLE "QuestionAttempt" ADD COLUMN IF NOT EXISTS "classificacaoVersao" TEXT;
ALTER TABLE "QuestionAttempt" ADD COLUMN IF NOT EXISTS "classificacaoConfianca" DOUBLE PRECISION;
ALTER TABLE "QuestionAttempt" ADD COLUMN IF NOT EXISTS "conceitosCanonicosJson" TEXT;
ALTER TABLE "QuestionAttempt" ADD COLUMN IF NOT EXISTS "classificacaoSecundariosJson" TEXT;
ALTER TABLE "QuestionAttempt" ADD COLUMN IF NOT EXISTS "metadadosCognitivosJson" TEXT;

CREATE INDEX IF NOT EXISTS "QuestionAttempt_conhecimentoEscopoId_idx" ON "QuestionAttempt"("conhecimentoEscopoId");

ALTER TABLE "Quest" ADD COLUMN IF NOT EXISTS "conhecimentoDominioId" TEXT;
ALTER TABLE "Quest" ADD COLUMN IF NOT EXISTS "conhecimentoEscopoId" TEXT;
ALTER TABLE "Quest" ADD COLUMN IF NOT EXISTS "conceitosCanonicosJson" TEXT;
ALTER TABLE "Quest" ADD COLUMN IF NOT EXISTS "fonteDiagnosticoJson" TEXT;
ALTER TABLE "Quest" ADD COLUMN IF NOT EXISTS "tipoQuest" TEXT;

CREATE INDEX IF NOT EXISTS "Quest_conhecimentoEscopoId_idx" ON "Quest"("conhecimentoEscopoId");

ALTER TABLE "LearningCycle" ADD COLUMN IF NOT EXISTS "metaEscopoId" TEXT;
ALTER TABLE "LearningCycle" ADD COLUMN IF NOT EXISTS "metaDominioId" TEXT;
ALTER TABLE "LearningCycle" ADD COLUMN IF NOT EXISTS "metaConceitosJson" TEXT;
ALTER TABLE "LearningCycle" ADD COLUMN IF NOT EXISTS "metaCognitivaJson" TEXT;
ALTER TABLE "LearningCycle" ADD COLUMN IF NOT EXISTS "narrativaInicioJson" TEXT;
ALTER TABLE "LearningCycle" ADD COLUMN IF NOT EXISTS "narrativaFimJson" TEXT;
ALTER TABLE "LearningCycle" ADD COLUMN IF NOT EXISTS "storytellingJson" TEXT;

CREATE INDEX IF NOT EXISTS "LearningCycle_metaEscopoId_idx" ON "LearningCycle"("metaEscopoId");
