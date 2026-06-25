/** N1 — roteamento: área + catálogo destino (disciplina / matéria corpus). */

export const CLASSIFICACAO_N1_VERSAO = "n1-v1";

export type ClassificacaoN1 = {
  versao: typeof CLASSIFICACAO_N1_VERSAO;
  area: "linguagens" | "humanas" | "exatas" | "natureza";
  /** ID do catálogo N2 destino: historia, matematica, biologia, portugues, … */
  catalogoId: string;
  confianca: number;
  criterio: string;
  justificativa: string;
  triagemNatureza?: {
    materia: string | null;
    via: "ia" | "manual" | "heuristica";
    motivo: string;
  };
  rota?: {
    disciplinaId: string;
    area: "humanas" | "linguagens";
  };
  classificadoEm: string;
};

export function parseClassificacaoN1(raw: string | null | undefined): ClassificacaoN1 | null {
  if (!raw?.trim()) return null;
  try {
    const o = JSON.parse(raw) as ClassificacaoN1;
    if (o?.versao !== CLASSIFICACAO_N1_VERSAO || !o.catalogoId || !o.area) return null;
    return o;
  } catch {
    return null;
  }
}

export function versaoLabelN1(n1: ClassificacaoN1): string {
  return `${CLASSIFICACAO_N1_VERSAO}|area=${n1.area}|cat=${n1.catalogoId}|conf=${n1.confianca.toFixed(2)}`;
}

export function n1Completo(n1: ClassificacaoN1 | null): boolean {
  return Boolean(n1?.catalogoId && n1.catalogoId !== "indefinido");
}
