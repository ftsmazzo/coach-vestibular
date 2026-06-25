-- Extração física: ordemExtracao identifica a linha; numero é o impresso no caderno (pode repetir).

ALTER TABLE "ProvaQuestao" ADD COLUMN "ordemExtracao" INTEGER;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY "provaId"
      ORDER BY numero ASC, "idiomaVariante" ASC, id ASC
    ) AS ordem
  FROM "ProvaQuestao"
)
UPDATE "ProvaQuestao" q
SET "ordemExtracao" = r.ordem
FROM ranked r
WHERE q.id = r.id;

ALTER TABLE "ProvaQuestao" ALTER COLUMN "ordemExtracao" SET NOT NULL;

DROP INDEX IF EXISTS "ProvaQuestao_provaId_numero_idiomaVariante_key";

CREATE UNIQUE INDEX "ProvaQuestao_provaId_ordemExtracao_key"
  ON "ProvaQuestao"("provaId", "ordemExtracao");

CREATE INDEX "ProvaQuestao_provaId_numero_idx"
  ON "ProvaQuestao"("provaId", "numero");
