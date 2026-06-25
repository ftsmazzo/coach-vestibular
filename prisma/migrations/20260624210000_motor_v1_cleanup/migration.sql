-- Motor v1: sugestões por escopo N2; remove correção legado em QuestionAttempt

ALTER TABLE "SugestaoClassificacao" ADD COLUMN IF NOT EXISTS "escopoAtualId" TEXT;
ALTER TABLE "SugestaoClassificacao" ADD COLUMN IF NOT EXISTS "escopoSugeridoId" TEXT;
ALTER TABLE "SugestaoClassificacao" ADD COLUMN IF NOT EXISTS "escopoLabelAtual" TEXT;
ALTER TABLE "SugestaoClassificacao" ADD COLUMN IF NOT EXISTS "escopoLabelSugerido" TEXT;
ALTER TABLE "SugestaoClassificacao" ADD COLUMN IF NOT EXISTS "catalogoId" TEXT;

ALTER TABLE "QuestionAttempt" DROP COLUMN IF EXISTS "materiaCorrigida";
ALTER TABLE "QuestionAttempt" DROP COLUMN IF EXISTS "assuntoCorrigido";
