/**
 * Resolução central de modelos OpenAI (pipeline, auditoria, extração legada).
 * Configure no servidor: OPENAI_MODEL_PIPELINE (+ FALLBACK) e opcionalmente OPENAI_MODEL_PASSO_2.
 */

export function modeloPipelinePrincipal(): string {
  return (
    process.env.OPENAI_MODEL_PIPELINE?.trim() ||
    process.env.OPENAI_MODEL_PASSO_2?.trim() ||
    process.env.OPENAI_MODEL?.trim() ||
    "gpt-4o"
  );
}

export function modeloPipelineFallback(): string {
  const fb =
    process.env.OPENAI_MODEL_PIPELINE_FALLBACK?.trim() ||
    process.env.OPENAI_MODEL_PASSO_2?.trim();
  const primary = modeloPipelinePrincipal();
  if (fb && fb !== primary) return fb;
  return primary;
}

/** Chat Completions: classificação unitária (auditoria) e motor legado. */
export function modeloClassificacao(): string {
  return modeloPipelinePrincipal();
}

/** Extração de enunciados (fluxo legado) — pode ser o mesmo ou um modelo mais barato. */
export function modeloExtracao(): string {
  const dedicated = process.env.OPENAI_MODEL_EXTRACAO?.trim();
  if (dedicated) return dedicated;
  const base = process.env.OPENAI_MODEL?.trim();
  if (base) return base;
  return modeloPipelinePrincipal();
}
