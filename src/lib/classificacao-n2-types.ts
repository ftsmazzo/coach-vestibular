/** Opções e helpers da fase N2 — escopo no catálogo N1. */

export type OpcoesFaseN2Prova = {
  /** Só questões sem escopo real (fallback ou vazio). */
  apenasSemEscopoReal?: boolean;
  /** Reprocessa questões com N2 automático já gravado. */
  reprocessarTodas?: boolean;
  /** Não sobrescreve escopo ajustado manualmente pelo admin. */
  preservarManuais?: boolean;
  /** Sobrescreve inclusive correções manuais. */
  forcarTudo?: boolean;
  /** Reprocessa só estas numerações. */
  numerosQuestao?: number[];
};

export type OpcoesFaseN2Resolvidas = {
  apenasSemEscopoReal: boolean;
  reprocessarTodas: boolean;
  preservarManuais: boolean;
  forcarTudo: boolean;
};

export function n2EhManual(questao: {
  classificacaoVersao?: string | null;
}): boolean {
  const v = questao.classificacaoVersao?.trim();
  return Boolean(v?.startsWith("n2-manual|"));
}

export function escopoN2Real(escopoId: string | null | undefined): boolean {
  const id = escopoId?.trim();
  return Boolean(id && !id.endsWith(".__nao_classificado"));
}

export function resolverOpcoesFaseN2(opts?: OpcoesFaseN2Prova): OpcoesFaseN2Resolvidas {
  if (opts?.forcarTudo) {
    return {
      apenasSemEscopoReal: false,
      reprocessarTodas: true,
      preservarManuais: false,
      forcarTudo: true,
    };
  }
  if (opts?.numerosQuestao?.length) {
    return {
      apenasSemEscopoReal: false,
      reprocessarTodas: true,
      preservarManuais: opts.preservarManuais !== false,
      forcarTudo: false,
    };
  }
  if (opts?.apenasSemEscopoReal) {
    return {
      apenasSemEscopoReal: true,
      reprocessarTodas: false,
      preservarManuais: true,
      forcarTudo: false,
    };
  }
  if (opts?.reprocessarTodas) {
    return {
      apenasSemEscopoReal: false,
      reprocessarTodas: true,
      preservarManuais: opts.preservarManuais !== false,
      forcarTudo: false,
    };
  }
  return {
    apenasSemEscopoReal: false,
    reprocessarTodas: true,
    preservarManuais: opts?.preservarManuais !== false,
    forcarTudo: false,
  };
}

export type MotivoPularN2 =
  | "ja_tem_escopo_real"
  | "manual_preservado"
  | "texto_insuficiente"
  | "n1_ausente";

export function deveProcessarQuestaoN2(
  questao: {
    conhecimentoEscopoId?: string | null;
    classificacaoVersao?: string | null;
  },
  opts: OpcoesFaseN2Resolvidas
): { processar: true } | { processar: false; motivo: MotivoPularN2 } {
  if (opts.forcarTudo) return { processar: true };

  if (opts.preservarManuais && n2EhManual(questao)) {
    return { processar: false, motivo: "manual_preservado" };
  }

  if (opts.apenasSemEscopoReal && !opts.reprocessarTodas) {
    if (escopoN2Real(questao.conhecimentoEscopoId)) {
      return { processar: false, motivo: "ja_tem_escopo_real" };
    }
    return { processar: true };
  }

  return { processar: true };
}
