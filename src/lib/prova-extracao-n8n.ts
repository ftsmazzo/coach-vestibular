import type { N8nQuestaoExtraida } from "@/lib/prova-atribuir-area-bloco";
import type { ProvaQuestaoRow } from "@/lib/parse-prova-csv";
import { ENUNCIADO_VALIDACAO_MIN_CHARS } from "@/lib/prova-texto-prova";

export type N8nExtracaoMetricas = {
  total_itens?: number;
  total_validas?: number;
  numeros_unicos?: number;
  total_esperado?: number | null;
};

export type N8nExtracaoResposta =
  | {
      status: "ok";
      fonte: "n8n";
      provaId?: string | null;
      metricas?: N8nExtracaoMetricas;
      questoes: N8nQuestaoExtraida[];
    }
  | {
      status: "fallback_pipeline";
      fonte: "n8n";
      provaId?: string | null;
      motivo: string;
      metricas?: N8nExtracaoMetricas;
      mensagem?: string;
    };

const N8N_TIMEOUT_MS = 90_000;
const COBERTURA_MIN_N8N = 0.85;

function urlExtracaoN8n(): string | null {
  const url = process.env.N8N_EXTRACAO_WEBHOOK_URL?.trim();
  return url || null;
}

function parseRespostaN8n(raw: unknown): N8nExtracaoResposta {
  const data = (raw ?? {}) as Record<string, unknown>;

  if (data.status === "fallback_pipeline") {
    return {
      status: "fallback_pipeline",
      fonte: "n8n",
      provaId: (data.provaId as string) ?? null,
      motivo: String(data.motivo ?? "COBERTURA_INCOMPLETA"),
      metricas: data.metricas as N8nExtracaoMetricas | undefined,
      mensagem: typeof data.mensagem === "string" ? data.mensagem : undefined,
    };
  }

  const questoes = Array.isArray(data.questoes)
    ? (data.questoes as N8nQuestaoExtraida[])
    : [];

  if (data.status === "ok" && questoes.length > 0) {
    return {
      status: "ok",
      fonte: "n8n",
      provaId: (data.provaId as string) ?? null,
      metricas: data.metricas as N8nExtracaoMetricas | undefined,
      questoes,
    };
  }

  if (questoes.length > 0) {
    return {
      status: "ok",
      fonte: "n8n",
      provaId: (data.provaId as string) ?? null,
      metricas: data.metricas as N8nExtracaoMetricas | undefined,
      questoes,
    };
  }

  return {
    status: "fallback_pipeline",
    fonte: "n8n",
    motivo: "RESPOSTA_INVALIDA",
    mensagem: "Resposta do n8n sem questões válidas.",
  };
}

export function n8nExtracaoDisponivel(): boolean {
  return Boolean(urlExtracaoN8n());
}

export async function chamarN8nExtracaoProva(opts: {
  pdfBuffer: Buffer;
  pdfNome: string;
  provaId: string;
  totalQuestoes: number | null;
}): Promise<N8nExtracaoResposta> {
  const url = urlExtracaoN8n();
  if (!url) {
    throw new Error("N8N_EXTRACAO_WEBHOOK_URL não configurada.");
  }

  const fd = new FormData();
  const blob = new Blob([new Uint8Array(opts.pdfBuffer)], { type: "application/pdf" });
  fd.append("file", blob, opts.pdfNome || "prova.pdf");
  fd.append("provaId", opts.provaId);
  if (opts.totalQuestoes != null && opts.totalQuestoes > 0) {
    fd.append("totalQuestoes", String(opts.totalQuestoes));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        ...(process.env.N8N_EXTRACAO_WEBHOOK_SECRET?.trim()
          ? { "X-Webhook-Secret": process.env.N8N_EXTRACAO_WEBHOOK_SECRET.trim() }
          : {}),
      },
      body: fd,
      signal: controller.signal,
    });

    const text = await res.text();
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error(`n8n retornou resposta não-JSON (HTTP ${res.status}).`);
    }

    if (!res.ok) {
      const errMsg =
        typeof parsed === "object" &&
        parsed &&
        "error" in parsed &&
        typeof (parsed as { error: unknown }).error === "string"
          ? (parsed as { error: string }).error
          : `HTTP ${res.status}`;
      throw new Error(`n8n: ${errMsg}`);
    }

    return parseRespostaN8n(parsed);
  } finally {
    clearTimeout(timeout);
  }
}

export function validarCoberturaExtracaoN8n(
  rows: ProvaQuestaoRow[],
  totalEsperado: number | null
): { ok: boolean; motivo?: string } {
  if (rows.length === 0) {
    return { ok: false, motivo: "Nenhuma questão após normalização do n8n." };
  }

  const ordens = rows.map((r) => r.ordemExtracao ?? 0);
  const ordemContigua =
    ordens.length > 0 &&
    ordens.every((o, i) => o === i + 1);
  if (!ordemContigua) {
    return {
      ok: false,
      motivo: "Ordens de extração não contíguas após import n8n — use fallback.",
    };
  }

  const comEnunciadoOk = rows.filter(
    (r) => (r.enunciado?.trim().length ?? 0) >= ENUNCIADO_VALIDACAO_MIN_CHARS
  );
  const comEnunciadoMin = rows.filter((r) => (r.enunciado?.trim().length ?? 0) >= 20);
  const numerosUnicos = new Set(rows.map((r) => r.numero)).size;

  if (comEnunciadoMin.length === 0) {
    return { ok: false, motivo: "Nenhuma questão com enunciado válido." };
  }

  if (!totalEsperado || totalEsperado <= 0) {
    return comEnunciadoMin.length >= 10
      ? { ok: true }
      : { ok: false, motivo: "Poucas questões extraídas e total esperado não cadastrado." };
  }

  const minUnicos = Math.floor(totalEsperado * COBERTURA_MIN_N8N);
  const minLinhasFisicas = Math.floor(totalEsperado * COBERTURA_MIN_N8N);

  if (numerosUnicos < minUnicos) {
    return {
      ok: false,
      motivo: `Cobertura lógica ${numerosUnicos}/${totalEsperado} números únicos (mín. ${minUnicos}).`,
    };
  }

  if (rows.length < minLinhasFisicas) {
    return {
      ok: false,
      motivo: `Cobertura física ${rows.length}/${totalEsperado} linhas (mín. ${minLinhasFisicas}).`,
    };
  }

  const ratioOk = comEnunciadoOk.length / rows.length;
  if (ratioOk < 0.55) {
    return {
      ok: false,
      motivo: `Muitos enunciados curtos após import (${comEnunciadoOk.length}/${rows.length} ≥ ${ENUNCIADO_VALIDACAO_MIN_CHARS} chars) — fallback recomendado.`,
    };
  }

  return { ok: true };
}
