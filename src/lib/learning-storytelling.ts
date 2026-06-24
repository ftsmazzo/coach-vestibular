import type { LearningCycle } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

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

export async function buildJourneyStory(userId: string): Promise<{
  resumo: string;
  cicloAtivo: CycleStory | null;
  ultimoCiclo: CycleStory | null;
}> {
  const [ativo, ultimoFechado] = await Promise.all([
    prisma.learningCycle.findFirst({
      where: { userId, status: "ATIVO" },
      orderBy: { createdAt: "desc" },
    }),
    prisma.learningCycle.findFirst({
      where: { userId, status: "FECHADO" },
      orderBy: { fechadoEm: "desc" },
    }),
  ]);

  let narrativaInicio: { hipotese?: string; objetivo?: string; estrategia?: string } | null =
    null;
  if (ativo?.narrativaInicioJson) {
    try {
      narrativaInicio = JSON.parse(ativo.narrativaInicioJson);
    } catch {
      narrativaInicio = null;
    }
  }

  const cicloAtivo = ativo
    ? buildCicloInicioStory(ativo, narrativaInicio)
    : null;

  const ultimoCiclo = ultimoFechado
    ? buildCycleStory(ultimoFechado)
    : null;

  const partes: string[] = [];
  if (cicloAtivo) {
    partes.push(cicloAtivo.paragrafos[0] ?? "");
  } else if (ultimoCiclo) {
    partes.push(ultimoCiclo.paragrafos[0] ?? "");
  } else {
    partes.push(
      "Sua jornada está sendo reconstruída escopo a escopo — cada prova alimenta focos mais precisos."
    );
  }

  return {
    resumo: partes.filter(Boolean).join(" "),
    cicloAtivo,
    ultimoCiclo,
  };
}

export function buildCicloInicioStory(
  cycle: Pick<LearningCycle, "metaTitulo" | "metaMateria" | "metaEscopoId" | "baselineJson">,
  narrativaInicio?: { hipotese?: string; objetivo?: string; estrategia?: string } | null
): CycleStory {
  const baseline = parseBaselineJson(cycle.baselineJson);
  const foco = baseline?.focos?.[0];
  const paragrafos: string[] = [];

  paragrafos.push(
    `Esta semana o foco não é a matéria inteira — é ${foco?.escopoLabel ?? cycle.metaTitulo.replace(/^Dominar:\s*/i, "")}.`
  );

  if (narrativaInicio?.hipotese) {
    paragrafos.push(narrativaInicio.hipotese);
  } else if (foco?.metadadosCognitivosResumo) {
    paragrafos.push(`Padrão detectado: ${foco.metadadosCognitivosResumo}.`);
  }

  if (narrativaInicio?.objetivo) {
    paragrafos.push(`Objetivo: ${narrativaInicio.objetivo}`);
  }

  if (foco?.questoesOrigem?.length) {
    paragrafos.push(
      `As questões ${foco.questoesOrigem.slice(0, 5).join(", ")} da sua jornada originaram este foco.`
    );
  }

  return {
    titulo: cycle.metaTitulo,
    paragrafos,
    proximoPasso: "Execute as tarefas em Quests — cada uma ataca este escopo com uma estratégia diferente.",
  };
}

export function buildStorytellingFechamento(
  cycle: Pick<
    LearningCycle,
    "metaTitulo" | "baselineJson" | "resultadoJson" | "narrativaInicioJson"
  >,
  quizPct: number | null,
  acertos: number,
  total: number,
  questsFeitas: number,
  questsTotal: number
): { storytelling: CycleStory; resultado: ResultadoCiclo; narrativaFim: string } {
  const baseline = parseBaselineJson(cycle.baselineJson);
  const foco = baseline?.focos?.[0];

  let narrativaInicio: { hipotese?: string; objetivo?: string } | null = null;
  if (cycle.narrativaInicioJson) {
    try {
      narrativaInicio = JSON.parse(cycle.narrativaInicioJson);
    } catch {
      /* ignora */
    }
  }

  const resultado: ResultadoCiclo = {
    execucao: {
      questsConcluidas: questsFeitas,
      questsPendentes: Math.max(0, questsTotal - questsFeitas),
    },
    ...(total > 0 && quizPct != null
      ? {
          avaliacao: {
            miniQuizTotal: total,
            miniQuizAcertos: acertos,
            pctAcerto: quizPct,
          },
        }
      : {}),
    ...(quizPct != null && narrativaInicio?.hipotese
      ? {
          mudancaCognitiva: {
            antes: narrativaInicio.hipotese.replace(/\.$/, ""),
            depois:
              quizPct >= 70
                ? "você consolidou o escopo no mini-quiz de fechamento"
                : quizPct >= 50
                  ? "há avanço parcial — vale repetir o foco"
                  : "o escopo ainda pede mais prática guiada",
          },
        }
      : {}),
  };

  const storytelling = buildCycleStory(
    { ...cycle, resultadoJson: JSON.stringify(resultado) },
    { focoLabel: foco?.escopoLabel, estrategia: narrativaInicio?.objetivo }
  );

  const narrativaFim =
    storytelling.paragrafos.join("\n\n") +
    (storytelling.proximoPasso ? `\n\n${storytelling.proximoPasso}` : "");

  return { storytelling, resultado, narrativaFim };
}
