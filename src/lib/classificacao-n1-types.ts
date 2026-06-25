/** N1 — roteamento: área + catálogo destino (disciplina / matéria corpus). */

export const CLASSIFICACAO_N1_VERSAO = "n1-v1";

export type OrigemClassificacaoN1 = "auto" | "manual";

export type AuditoriaN1 = {
  classificacaoN1Anterior: string | null;
  classificacaoN1Nova: string;
  criterioN1: string;
  justificativaN1: string;
  classificadoEm: string;
  reprocessadoEm: string;
  origem: OrigemClassificacaoN1;
};

export type ClassificacaoN1 = {
  versao: typeof CLASSIFICACAO_N1_VERSAO;
  area: "linguagens" | "humanas" | "exatas" | "natureza";
  /** ID do catálogo N2 destino: historia, matematica, biologia, portugues, … */
  catalogoId: string;
  confianca: number;
  criterio: string;
  justificativa: string;
  origem?: OrigemClassificacaoN1;
  ultimaAuditoria?: AuditoriaN1;
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

export function n1EhManual(n1: ClassificacaoN1 | null | undefined): boolean {
  if (!n1) return false;
  return (
    n1.origem === "manual" ||
    n1.criterio === "manual" ||
    n1.triagemNatureza?.via === "manual"
  );
}

export function catalogoN1Mudou(
  anterior: ClassificacaoN1 | null,
  novo: ClassificacaoN1
): boolean {
  const idAnt = anterior?.catalogoId ?? null;
  return idAnt !== novo.catalogoId;
}

export function camposLimpezaN2N3() {
  return {
    conhecimentoDominioId: null,
    conhecimentoEscopoId: null,
    classificacaoConfianca: null,
    classificacaoSecundariosJson: null,
    conceitosCanonicosJson: null,
    conhecimentoExigido: null,
  } as const;
}

export function montarN1AutomaticoComAuditoria(
  n1: ClassificacaoN1,
  n1Anterior: ClassificacaoN1 | null,
  reprocessadoEm: string
): ClassificacaoN1 {
  const n1Auto: ClassificacaoN1 = { ...n1, origem: "auto" };
  if (catalogoN1Mudou(n1Anterior, n1)) {
    n1Auto.ultimaAuditoria = {
      classificacaoN1Anterior: n1Anterior?.catalogoId ?? null,
      classificacaoN1Nova: n1.catalogoId,
      criterioN1: n1.criterio,
      justificativaN1: n1.justificativa,
      classificadoEm: n1.classificadoEm,
      reprocessadoEm,
      origem: "auto",
    };
  }
  return n1Auto;
}

export type OpcoesFaseN1Prova = {
  /** Só questões sem N1 completo. */
  apenasFaltantes?: boolean;
  /** Reprocessa questões com N1 automático já gravado. */
  reprocessarTodas?: boolean;
  /** Não sobrescreve N1 ajustado manualmente pelo admin (padrão ao reprocessar). */
  preservarManuais?: boolean;
  /** Sobrescreve inclusive correções manuais — uso explícito apenas. */
  forcarTudo?: boolean;
};

export type OpcoesFaseN1Resolvidas = {
  apenasFaltantes: boolean;
  reprocessarTodas: boolean;
  preservarManuais: boolean;
  forcarTudo: boolean;
};

export function resolverOpcoesFaseN1(opts?: OpcoesFaseN1Prova): OpcoesFaseN1Resolvidas {
  if (opts?.forcarTudo) {
    return {
      apenasFaltantes: false,
      reprocessarTodas: true,
      preservarManuais: false,
      forcarTudo: true,
    };
  }
  if (opts?.reprocessarTodas) {
    return {
      apenasFaltantes: false,
      reprocessarTodas: true,
      preservarManuais: opts.preservarManuais !== false,
      forcarTudo: false,
    };
  }
  if (opts?.apenasFaltantes === false) {
    return {
      apenasFaltantes: false,
      reprocessarTodas: true,
      preservarManuais: opts.preservarManuais !== false,
      forcarTudo: false,
    };
  }
  return {
    apenasFaltantes: true,
    reprocessarTodas: false,
    preservarManuais: true,
    forcarTudo: false,
  };
}

export type MotivoPularN1 =
  | "ja_tem_n1"
  | "manual_preservado"
  | "texto_insuficiente"
  | "area_indefinida"
  | "classificacao_falhou";

export function deveProcessarQuestaoN1(
  n1Anterior: ClassificacaoN1 | null,
  opts: OpcoesFaseN1Resolvidas
): { processar: true } | { processar: false; motivo: MotivoPularN1 } {
  if (opts.forcarTudo) return { processar: true };

  if (opts.apenasFaltantes && !opts.reprocessarTodas) {
    if (n1Completo(n1Anterior)) {
      return { processar: false, motivo: "ja_tem_n1" };
    }
    return { processar: true };
  }

  if (opts.reprocessarTodas && opts.preservarManuais && n1EhManual(n1Anterior)) {
    return { processar: false, motivo: "manual_preservado" };
  }

  return { processar: true };
}
