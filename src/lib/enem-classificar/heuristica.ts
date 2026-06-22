import type { EscopoIndexEntry, ResultadoClassificacao } from "@/lib/conhecimento-catalog/types";

function normalizarTexto(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

export type ClassificarHeuristicaOpts = {
  confiancaMinima: number;
  /** Restringe candidatos a um assunto (ex.: piloto ecologia) */
  assuntoId?: string;
};

const DEFAULT_OPTS: ClassificarHeuristicaOpts = {
  confiancaMinima: 0.35,
};

/**
 * Classificador v0 — match por keywords do catálogo.
 * IA escolhe só IDs; abaixo do limiar → unclassified (nunca força o mais próximo).
 */
export function classificarPorKeywords(
  enunciado: string,
  escopos: Map<string, EscopoIndexEntry>,
  opts: ClassificarHeuristicaOpts = DEFAULT_OPTS
): ResultadoClassificacao {
  const texto = normalizarTexto(enunciado);
  if (texto.length < 20) {
    return {
      status: "unclassified",
      confianca: 0,
      materiaId: null,
      assuntoId: null,
      dominioId: null,
      escopoId: null,
      conceitoCanonic: null,
      motivo: "enunciado insuficiente",
    };
  }

  let melhor: { entry: EscopoIndexEntry; score: number; hits: string[] } | null = null;
  let segundoScore = 0;

  for (const entry of escopos.values()) {
    if (opts.assuntoId && entry.assuntoId !== opts.assuntoId) continue;

    const termos = [
      ...entry.keywords,
      ...entry.escopoLabel.split(/[\s—,()]+/).filter((w) => w.length > 4),
    ];
    const hits: string[] = [];
    let score = 0;

    for (const termo of termos) {
      const t = normalizarTexto(termo);
      if (t.length < 4) continue;
      if (texto.includes(t)) {
        hits.push(termo);
        score += t.length >= 8 ? 2 : 1;
      }
    }

    if (score === 0) continue;

    if (!melhor || score > melhor.score) {
      segundoScore = melhor?.score ?? 0;
      melhor = { entry, score, hits };
    } else if (score > segundoScore) {
      segundoScore = score;
    }
  }

  if (!melhor) {
    return {
      status: "unclassified",
      confianca: 0,
      materiaId: null,
      assuntoId: null,
      dominioId: null,
      escopoId: null,
      conceitoCanonic: null,
      motivo: "nenhum N2 com keyword match",
    };
  }

  const maxScore = melhor.score;
  const confianca = maxScore > 0 ? (maxScore - segundoScore * 0.5) / (maxScore + 2) : 0;
  const confiancaNorm = Math.min(1, Math.max(0, confianca));

  if (confiancaNorm < opts.confiancaMinima) {
    return {
      status: "unclassified",
      confianca: confiancaNorm,
      materiaId: melhor.entry.materiaId,
      assuntoId: melhor.entry.assuntoId,
      dominioId: melhor.entry.dominioId,
      escopoId: null,
      conceitoCanonic: null,
      motivo: `confiança ${confiancaNorm.toFixed(2)} < ${opts.confiancaMinima}`,
    };
  }

  if (segundoScore >= maxScore * 0.85) {
    return {
      status: "review",
      confianca: confiancaNorm,
      materiaId: melhor.entry.materiaId,
      assuntoId: melhor.entry.assuntoId,
      dominioId: melhor.entry.dominioId,
      escopoId: melhor.entry.escopoId,
      conceitoCanonic: melhor.entry.conceitoCanonic ?? null,
      motivo: `empate entre candidatos (hits: ${melhor.hits.join(", ")})`,
    };
  }

  return {
    status: "classified",
    confianca: confiancaNorm,
    materiaId: melhor.entry.materiaId,
    assuntoId: melhor.entry.assuntoId,
    dominioId: melhor.entry.dominioId,
    escopoId: melhor.entry.escopoId,
    conceitoCanonic: melhor.entry.conceitoCanonic ?? null,
    motivo: `keywords: ${melhor.hits.join(", ")}`,
  };
}

export type BenchmarkClassificacao = {
  total: number;
  classified: number;
  unclassified: number;
  review: number;
  pctClassified: number;
  pctUnclassified: number;
  topEscopos: Array<{ escopoId: string; count: number }>;
  filaRevisao: Array<{ fonteId: string; escopoId: string | null; confianca: number; motivo: string }>;
};

export function agregarBenchmark(
  resultados: Array<{ fonteId: string; resultado: ResultadoClassificacao }>
): BenchmarkClassificacao {
  const total = resultados.length;
  let classified = 0;
  let unclassified = 0;
  let review = 0;
  const contagem = new Map<string, number>();
  const filaRevisao: BenchmarkClassificacao["filaRevisao"] = [];

  for (const { fonteId, resultado } of resultados) {
    if (resultado.status === "classified") classified++;
    else if (resultado.status === "unclassified") unclassified++;
    else review++;

    if (resultado.escopoId) {
      contagem.set(resultado.escopoId, (contagem.get(resultado.escopoId) ?? 0) + 1);
    }

    if (resultado.status !== "classified") {
      filaRevisao.push({
        fonteId,
        escopoId: resultado.escopoId,
        confianca: resultado.confianca,
        motivo: resultado.motivo,
      });
    }
  }

  const topEscopos = [...contagem.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([escopoId, count]) => ({ escopoId, count }));

  return {
    total,
    classified,
    unclassified,
    review,
    pctClassified: total ? Math.round((classified / total) * 100) : 0,
    pctUnclassified: total ? Math.round((unclassified / total) * 100) : 0,
    topEscopos,
    filaRevisao: filaRevisao.slice(0, 30),
  };
}
