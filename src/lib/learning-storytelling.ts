import type { LearningCycle } from "@/generated/prisma/client";

export type BaselineCicloEscopo = {
  escopoId: string;
  escopoLabel: string;
  errosRecentes: number;
  questoesOrigem: number[];
  taxaAcerto: number;
  tipoErroDominante?: string | null;
  metadadosCognitivosResumo?: string | null;
  objetivo?: string;
};

export type BaselineCiclo = {
  focos?: BaselineCicloEscopo[];
  /** legado cluster */
  clusterId?: string | null;
  materia?: string | null;
  pctMateria?: number | null;
  erros?: number;
  recorrencia?: number;
  capturadoEm?: string;
};

export type ResultadoCiclo = {
  execucao?: {
    questsConcluidas: number;
    questsPendentes: number;
    tempoTotalMin?: number;
  };
  avaliacao?: {
    miniQuizTotal: number;
    miniQuizAcertos: number;
    pctAcerto: number;
  };
  mudancaCognitiva?: {
    antes: string;
    depois: string;
  };
};

export type MudancaAprendizagem = {
  escopoId?: string;
  tipo: "melhora" | "estavel" | "atencao";
  descricao: string;
};

export type CycleStory = {
  titulo: string;
  paragrafos: string[];
  proximoPasso?: string;
};

export type CycleContext = {
  focoLabel?: string;
  estrategia?: string;
};

export function parseBaselineJson(raw: string | null | undefined): BaselineCiclo | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as BaselineCiclo;
  } catch {
    return null;
  }
}

export function parseResultadoJson(raw: string | null | undefined): ResultadoCiclo | null {
  if (!raw?.trim()) return null;
  try {
    return JSON.parse(raw) as ResultadoCiclo;
  } catch {
    return null;
  }
}

export function compararBaselineResultado(
  baseline: BaselineCiclo,
  resultado: ResultadoCiclo
): MudancaAprendizagem[] {
  const mudancas: MudancaAprendizagem[] = [];

  const pct = resultado.avaliacao?.pctAcerto;
  if (pct != null) {
    const foco = baseline.focos?.[0];
    mudancas.push({
      escopoId: foco?.escopoId,
      tipo: pct >= 70 ? "melhora" : pct >= 50 ? "estavel" : "atencao",
      descricao:
        pct >= 70
          ? `No mini-quiz de fechamento você acertou ${pct}% — sinal de consolidação.`
          : pct >= 50
            ? `Acerto de ${pct}% no fechamento — há avanço, mas ainda vale revisar o foco.`
            : `Acerto de ${pct}% — o foco ainda precisa de mais prática guiada.`,
    });
  }

  if (resultado.mudancaCognitiva) {
    mudancas.push({
      tipo: "melhora",
      descricao: `Antes: ${resultado.mudancaCognitiva.antes} Depois: ${resultado.mudancaCognitiva.depois}`,
    });
  }

  return mudancas;
}

export function buildCycleStory(
  cycle: Pick<
    LearningCycle,
    "metaTitulo" | "baselineJson" | "resultadoJson" | "storytellingJson"
  >,
  context?: CycleContext
): CycleStory {
  if (cycle.storytellingJson?.trim()) {
    try {
      const parsed = JSON.parse(cycle.storytellingJson) as CycleStory;
      if (parsed.paragrafos?.length) return parsed;
    } catch {
      /* gera abaixo */
    }
  }

  const baseline = parseBaselineJson(cycle.baselineJson);
  const resultado = parseResultadoJson(cycle.resultadoJson);
  const foco = baseline?.focos?.[0];
  const paragrafos: string[] = [];

  paragrafos.push(
    `Neste ciclo, seu foco não foi estudar uma matéria inteira — foi algo mais preciso: ${context?.focoLabel ?? foco?.escopoLabel ?? cycle.metaTitulo}.`
  );

  if (foco?.metadadosCognitivosResumo) {
    paragrafos.push(
      `No início, o padrão mais claro era: ${foco.metadadosCognitivosResumo}.`
    );
  } else if (foco?.tipoErroDominante) {
    paragrafos.push(
      `Seus erros nesse escopo tinham como causa dominante: ${foco.tipoErroDominante.replace(/_/g, " ").toLowerCase()}.`
    );
  }

  if (resultado?.avaliacao) {
    paragrafos.push(
      `Ao fechar o ciclo, você acertou ${resultado.avaliacao.miniQuizAcertos} de ${resultado.avaliacao.miniQuizTotal} questões semelhantes (${resultado.avaliacao.pctAcerto}%).`
    );
  }

  if (resultado?.mudancaCognitiva) {
    paragrafos.push(
      `O avanço principal foi de comportamento: antes você ${resultado.mudancaCognitiva.antes.toLowerCase()}; agora ${resultado.mudancaCognitiva.depois.toLowerCase()}.`
    );
  }

  return {
    titulo: cycle.metaTitulo,
    paragrafos,
    proximoPasso: "Na próxima semana, o sistema vai atacar o próximo foco com base nos dados mais recentes.",
  };
}

export async function buildJourneyStory(_userId: string): Promise<{ resumo: string }> {
  return {
    resumo:
      "Sua jornada está sendo reconstruída escopo a escopo — cada prova alimenta focos mais precisos.",
  };
}
