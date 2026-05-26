function modeloPipelinePrincipal(): string {
  return (
    process.env.OPENAI_MODEL_PIPELINE?.trim() ||
    process.env.OPENAI_MODEL_PASSO_2?.trim() ||
    "gpt-4o"
  );
}

function modeloPipelineFallback(): string {
  return (
    process.env.OPENAI_MODEL_PIPELINE_FALLBACK?.trim() ||
    process.env.OPENAI_MODEL_PASSO_2?.trim() ||
    "gpt-4o"
  );
}

export type FallbackExecResult<T> = {
  model: string;
  tier: "primary" | "fallback";
  attempt: number;
  resultado: T;
};

function retriesPrimary(): number {
  const n = parseInt(process.env.PIPELINE_V2_RETRIES_PRIMARY ?? "2", 10);
  return Number.isFinite(n) && n >= 1 ? n : 2;
}

function retriesFallback(): number {
  const n = parseInt(process.env.PIPELINE_V2_RETRIES_FALLBACK ?? "1", 10);
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

/**
 * Executa com modelo principal; só escala para fallback se run/validate falhar.
 * Não chama os dois modelos quando o resultado já passa na validação.
 */
export async function executarComFallback<T>(opts: {
  taskName: string;
  primaryModel?: string;
  fallbackModel?: string;
  retriesPerModel?: { primary?: number; fallback?: number };
  run: (model: string) => Promise<T>;
  validate: (resultado: T) => void;
  onRetry?: (info: { model: string; tier: "primary" | "fallback"; attempt: number; error: Error }) => void;
}): Promise<FallbackExecResult<T>> {
  const primary = opts.primaryModel ?? modeloPipelinePrincipal();
  const fallback = opts.fallbackModel ?? modeloPipelineFallback();
  const rPrimary = opts.retriesPerModel?.primary ?? retriesPrimary();
  const rFallback = opts.retriesPerModel?.fallback ?? retriesFallback();

  const tiers: Array<{ model: string; tier: "primary" | "fallback"; retries: number }> = [
    { model: primary, tier: "primary", retries: rPrimary },
  ];
  if (fallback !== primary) {
    tiers.push({ model: fallback, tier: "fallback", retries: rFallback });
  }

  let ultimoErro: Error | undefined;

  for (const { model, tier, retries } of tiers) {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const resultado = await opts.run(model);
        opts.validate(resultado);
        return { model, tier, attempt, resultado };
      } catch (err) {
        ultimoErro = err instanceof Error ? err : new Error(String(err));
        opts.onRetry?.({ model, tier, attempt, error: ultimoErro });
        console.warn(
          `[pipeline:${opts.taskName}] ${model} tentativa ${attempt}/${retries}: ${ultimoErro.message}`
        );
      }
    }
  }

  throw new Error(
    `[${opts.taskName}] falhou em todas as tentativas. Último erro: ${ultimoErro?.message ?? "desconhecido"}`
  );
}
