-- AlterEnum
-- This migration adds the 'LISTA_FIXACAO' value to the 'ProvaTipo' enum, and replaces the 'ErrorType' enum with new metacognitive options.

-- AlterEnum
ALTER TYPE "ProvaTipo" ADD VALUE 'LISTA_FIXACAO';

-- Rename old ErrorType enum and create the new one
ALTER TYPE "ErrorType" RENAME TO "ErrorType_old";
CREATE TYPE "ErrorType" AS ENUM ('CONCEITO_TEORICO', 'CALCULO_BOBEIRA', 'INTERPRETACAO_ENUNCIADO', 'DUVIDA_CRUCIAL', 'CHUTE_TOTAL', 'FALTA_TEMPO');

-- Alter the QuestionAttempt column to use the new ErrorType, mapping the old values to the new ones
ALTER TABLE "QuestionAttempt" ALTER COLUMN "tipoErro" TYPE "ErrorType" USING (
  CASE "tipoErro"::text
    WHEN 'base_teorica' THEN 'CONCEITO_TEORICO'::"ErrorType"
    WHEN 'interpretacao' THEN 'INTERPRETACAO_ENUNCIADO'::"ErrorType"
    WHEN 'atencao' THEN 'CALCULO_BOBEIRA'::"ErrorType"
    WHEN 'tempo' THEN 'FALTA_TEMPO'::"ErrorType"
    ELSE NULL
  END
);

-- Drop the old enum
DROP TYPE "ErrorType_old";
