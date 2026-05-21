-- Texto fonte da prova (para reauditar) e trecho do enunciado por questão
ALTER TABLE "Prova" ADD COLUMN IF NOT EXISTS "textoFonte" TEXT;

ALTER TABLE "ProvaQuestao" ADD COLUMN IF NOT EXISTS "enunciado" TEXT;
