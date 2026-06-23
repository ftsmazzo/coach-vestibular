import type { EscopoIndexEntry, ResultadoClassificacao } from "@/lib/conhecimento-catalog/types";

function normalizarTexto(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

function tokensDeTexto(s: string, minLen = 3): string[] {
  return s
    .split(/[\s—,()/]+/)
    .map((w) => normalizarTexto(w))
    .filter((w) => w.length >= minLen);
}

export type ClassificarHeuristicaOpts = {
  confiancaMinima: number;
  assuntoId?: string;
};

const DEFAULT_OPTS: ClassificarHeuristicaOpts = {
  confiancaMinima: 0.28,
};

function termosDoEscopo(entry: EscopoIndexEntry): Array<{ termo: string; peso: number }> {
  const pesoForte = 1;
  const pesoCtx = 0.4;
  const base: Array<{ termo: string; peso: number }> = [
    ...entry.keywords.map((k) => ({ termo: k, peso: pesoForte })),
    ...entry.keywordsContexto.map((k) => ({ termo: k, peso: pesoCtx })),
    ...tokensDeTexto(entry.escopoLabel, 4).map((t) => ({ termo: t, peso: pesoForte })),
    ...tokensDeTexto(entry.dominioLabel, 4).map((t) => ({ termo: t, peso: pesoCtx })),
    ...tokensDeTexto(entry.assuntoLabel, 4).map((t) => ({ termo: t, peso: pesoCtx })),
  ];
  const seen = new Set<string>();
  return base.filter(({ termo }) => {
    const n = normalizarTexto(termo);
    if (n.length < 3 || seen.has(n)) return false;
    seen.add(n);
    return true;
  });
}

/** Classificador v1 — score ≥ 1 com candidato líder → N2 (review se empate). */
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

  const candidatos: Array<{ entry: EscopoIndexEntry; score: number; hits: string[] }> = [];

  for (const entry of escopos.values()) {
    if (opts.assuntoId && entry.assuntoId !== opts.assuntoId) continue;
    if (entry.ehFallback) continue;

    const hits: string[] = [];
    let score = 0;

    for (const { termo, peso } of termosDoEscopo(entry)) {
      const n = normalizarTexto(termo);
      if (texto.includes(n)) {
        hits.push(termo);
        score += (n.length >= 8 ? 2 : 1) * peso;
      }
    }

    if (score > 0) candidatos.push({ entry, score, hits });
  }

  candidatos.sort((a, b) => b.score - a.score);

  if (candidatos.length === 0) {
    return {
      status: "unclassified",
      confianca: 0,
      materiaId: null,
      assuntoId: null,
      dominioId: null,
      escopoId: null,
      conceitoCanonic: null,
      motivo: "nenhum N2 com match",
    };
  }

  const melhor = candidatos[0]!;
  const segundoScore = candidatos[1]?.score ?? 0;
  const confianca = Math.min(0.95, 0.35 + melhor.score * 0.12 - segundoScore * 0.08);

  const base = {
    materiaId: melhor.entry.materiaId,
    assuntoId: melhor.entry.assuntoId,
    dominioId: melhor.entry.dominioId,
    conceitoCanonic: melhor.entry.conceitoCanonic ?? null,
    confianca,
  };

  if (segundoScore === 0 || melhor.score >= segundoScore + 2) {
    return {
      status: "classified",
      escopoId: melhor.entry.escopoId,
      ...base,
      motivo: `match: ${melhor.hits.slice(0, 4).join(", ")}`,
    };
  }

  if (melhor.score >= 1 && confianca >= opts.confiancaMinima) {
    return {
      status: segundoScore >= melhor.score ? "review" : "classified",
      escopoId: melhor.entry.escopoId,
      ...base,
      motivo: `candidato: ${melhor.hits.slice(0, 3).join(", ")}`,
    };
  }

  return {
    status: "unclassified",
    escopoId: null,
    ...base,
    motivo: `score fraco (${melhor.score} vs ${segundoScore})`,
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
