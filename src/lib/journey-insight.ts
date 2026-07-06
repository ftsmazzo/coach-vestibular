/**
 * Síntese pedagógica da Home — motor v1 (escopo N2).
 * Consumidores só leem focosPedagogicos para decisão de missão/plano.
 */
import type { RegistroDashboardCard } from "@/lib/jornada-analytics";
import { aggregateJourneyLearning, materiasComDadosReais } from "@/lib/jornada-analytics";
import { buildMetacognicaoGlobalJornada } from "@/lib/jornada-metacognicao";
import { buildResumoJornada } from "@/lib/jornada";
import { getPlanoAtual } from "@/lib/plano-atual";
import {
  garantirQuestsAlavanca,
  getOQueFazerAgora,
} from "@/lib/quests-alavanca";
import { pctAcertoRegistro } from "@/lib/exam-stats";
import { prisma } from "@/lib/prisma";
import { getAnamneseMotorContext } from "@/lib/anamnese-motor";
import { linhaContrasteAnamneseEscopo } from "@/lib/anamnese-contexto";
import type { FocoPedagogico } from "@/lib/diagnosis-escopo";
import { getFocosPedagogicosRecentes } from "@/lib/learning-motor-foco";
import { getCoberturaN2 } from "@/lib/motor-cobertura-n2";
import type { AnamneseMotorContext } from "@/lib/anamnese-types";
import type { CopilotoNarrativa } from "@/lib/copiloto-ia-types";
import { buildCicloInicioStory } from "@/lib/learning-storytelling";
import { getCicloAtivo } from "@/lib/ciclo";
import {
  avaliarElegibilidadeJornada,
  jornadaFoiIniciada,
  type ElegibilidadeJornada,
} from "@/lib/jornada-elegibilidade";
import {
  buscarDiagnosticoInicialJornada,
  type DiagnosticoInicialResumo,
} from "@/lib/jornada-diagnostico-inicial";
import {
  buscarResumoCicloInicialJornada,
  type CicloInicialResumo,
} from "@/lib/jornada-ciclo-inicial";

export type TendenciaJornada = "subindo" | "estavel" | "cuidado" | "inicio";

export type IncidenciaJornada = "alta" | "media" | "baixa";

export type AlavancaJornada = {
  materiaId: string;
  label: string;
  pctAcerto: number;
  potencial: "alto" | "medio";
  incidencia: IncidenciaJornada;
  mensagem: string;
};

export type GargaloEscopoInsight = {
  descricao: string;
  escopoLabel: string;
  materiaContexto: string | null;
  pctAcertoEscopo: number | null;
  erros: number;
  hipoteseCausa: string | null;
  objetivoSemana: string | null;
  metadadosResumo: string | null;
  materiaDeficitPrincipal: string | null;
};

export type DiagnosticoIntegrado = {
  titulo: string;
  paragrafo: string;
  lacunaChave: string;
};

export type CopilotoCamadas = {
  oQueAcontece: string;
  comoCognitivo: string;
  quandoAparece: string;
  naoSignifica: string;
  caminho: string;
};

export type NarrativaEscopo = {
  titulo: string;
  paragrafo: string;
  camadas: CopilotoCamadas;
  linhaFoco: string;
  proximoPasso: string;
};

export type JourneyInsight = {
  context: "JOURNEY";
  /** Jornada longitudinal ativa (após Iniciar Jornada), não apenas ter registros. */
  temDados: boolean;
  jornadaIniciada: boolean;
  elegibilidade: ElegibilidadeJornada;
  /** Tem ao menos um registro de prova/simulado (relatórios disponíveis). */
  temRegistrosProva: boolean;
  /** Marco zero imutável — Etapa 2. */
  diagnosticoInicial: DiagnosticoInicialResumo | null;
  /** Semana 1 / primeiro LearningCycle — Etapa 3. */
  cicloInicial: CicloInicialResumo | null;
  focoPrincipal: FocoPedagogico | null;
  focosSecundarios: FocoPedagogico[];
  principalGargalo: GargaloEscopoInsight | null;
  copiloto: NarrativaEscopo | null;
  temDiagnosticoEscopo: boolean;
  coberturaN2: Awaited<ReturnType<typeof getCoberturaN2>> | null;
  principalAlavanca: AlavancaJornada | null;
  focoSemana: string | null;
  missao: {
    focoTitulo: string;
    focoDescricao: string;
    impactoEstimado: string | null;
    questsPendentes: Array<{ id: string; titulo: string }>;
    temPlano: boolean;
  } | null;
  estado: {
    tendencia: TendenciaJornada;
    tendenciaLabel: string;
    pctAcertoPonderado: number;
    totalRegistros: number;
    consistenciaLabel: string;
    riscoLabel: string;
    recoveryMode: boolean;
    metaAlvo: string;
  } | null;
  padraoCognitivo: {
    insight: string;
    causaDominante: string | null;
    pctErrosClassificados: number;
  } | null;
  diagnosticoIntegrado: DiagnosticoIntegrado | null;
  alavancas: AlavancaJornada[];
  atividadesRecentes: RegistroDashboardCard[];
  focosPedagogicos: FocoPedagogico[];
  anamnese: AnamneseMotorContext;
  linhaAnamnese: string | null;
};

function calcularTendencia(pcts: number[]): { tendencia: TendenciaJornada; label: string } {
  if (pcts.length === 0) return { tendencia: "inicio", label: "Comece registrando uma atividade" };
  if (pcts.length === 1) {
    return {
      tendencia: "inicio",
      label: `Primeiro registro: ${pcts[0]}% — a tendência aparece na segunda prova`,
    };
  }
  const ultimo = pcts[pcts.length - 1]!;
  const penultimo = pcts[pcts.length - 2]!;
  const delta = ultimo - penultimo;
  if (delta >= 5) {
    return { tendencia: "subindo", label: `Evolução recente: +${delta}% no último registro` };
  }
  if (delta <= -5) {
    return { tendencia: "cuidado", label: `Pressão recente: ${delta}% no último registro` };
  }
  return { tendencia: "estavel", label: "Ritmo estável entre os últimos registros" };
}

function incidenciaPorVolume(questoes: number): IncidenciaJornada {
  if (questoes >= 12) return "alta";
  if (questoes >= 5) return "media";
  return "baixa";
}

function labelIncidencia(i: IncidenciaJornada): string {
  if (i === "alta") return "muito presente na jornada";
  if (i === "media") return "presença moderada";
  return "poucas questões na jornada";
}

function calcularAlavancas(
  materias: Array<{
    materiaId: string;
    label: string;
    pctAcerto: number;
    errosPonderados: number;
    totalQuestoes: number;
  }>
): AlavancaJornada[] {
  return materias
    .map((m) => {
      const gap = Math.max(0, 100 - m.pctAcerto);
      const pressao = m.errosPonderados + m.totalQuestoes * 0.15;
      const incidencia = incidenciaPorVolume(m.totalQuestoes);
      const pesoIncidencia = incidencia === "alta" ? 1.2 : incidencia === "media" ? 1 : 0.65;
      const score = gap * Math.log1p(pressao) * pesoIncidencia;
      const potencial: "alto" | "medio" =
        score >= 12 && incidencia !== "baixa" ? "alto" : "medio";
      return {
        materiaId: m.materiaId,
        label: m.label,
        pctAcerto: m.pctAcerto,
        potencial,
        incidencia,
        score,
        mensagem:
          potencial === "alto"
            ? `Corrigir ${m.label} tende a liberar mais nota (${m.pctAcerto}% hoje, ${labelIncidencia(incidencia)}).`
            : `${m.label}: impacto limitado por baixo volume na jornada (${m.pctAcerto}%).`,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ score: _s, ...rest }) => rest);
}

function narrativaFromFoco(foco: FocoPedagogico): NarrativaEscopo {
  const meta = foco.metadadosCognitivosResumo?.resumoTexto;
  return {
    titulo: foco.escopoLabel,
    paragrafo: foco.hipoteseCausa,
    camadas: {
      oQueAcontece: `Na jornada, ${foco.totalErros} erro(s) concentrados em ${foco.escopoLabel} (${foco.materiaLabel}).`,
      comoCognitivo: meta ?? foco.hipoteseCausa,
      quandoAparece: `Questões ${foco.numerosErrados.slice(0, 6).join(", ")}${foco.numerosErrados.length > 6 ? "…" : ""}.`,
      naoSignifica: "Isso não define seu vestibular — é o ponto onde treinar esta semana rende mais.",
      caminho: foco.objetivoDaSemana,
    },
    linhaFoco: foco.hipoteseCausa,
    proximoPasso: foco.objetivoDaSemana,
  };
}

export async function buildJourneyInsight(userId: string): Promise<JourneyInsight> {
  const [
    resumo,
    metacognicao,
    planoData,
    analytics,
    anamneseCtx,
    ultimosExams,
    focosPedagogicos,
    coberturaN2,
    cicloAtivo,
    elegibilidade,
    jornadaIniciada,
    diagnosticoInicial,
    cicloInicial,
  ] = await Promise.all([
    buildResumoJornada(userId),
    buildMetacognicaoGlobalJornada(userId),
    getPlanoAtual(userId),
    aggregateJourneyLearning(userId, "todos"),
    getAnamneseMotorContext(userId),
    prisma.exam.findMany({
      where: { userId },
      orderBy: { data: "asc" },
      take: 6,
      select: {
        recoveryMode: true,
        questionAttempts: { select: { correto: true } },
      },
    }),
    getFocosPedagogicosRecentes(userId, 5),
    getCoberturaN2(userId),
    getCicloAtivo(userId),
    avaliarElegibilidadeJornada(userId),
    jornadaFoiIniciada(userId),
    buscarDiagnosticoInicialJornada(userId),
    buscarResumoCicloInicialJornada(userId),
  ]);

  const temRegistrosProva = resumo.totalRegistros > 0;
  const temPlanoJornadaAtivo = Boolean(planoData.plan);
  const insightBase = {
    jornadaIniciada,
    elegibilidade,
    temRegistrosProva,
    diagnosticoInicial,
    cicloInicial,
  };

  const usaIa =
    planoData.plan?.fonteGeracao === "ia" && Boolean(planoData.plan?.narrative);

  if (!jornadaIniciada) {
    const missaoAnamnese =
      anamneseCtx.completed && anamneseCtx.focoInicialTitulo && temRegistrosProva
        ? {
            focoTitulo: anamneseCtx.focoInicialTitulo,
            focoDescricao:
              anamneseCtx.focoInicialDescricao ??
              "Registre mais provas do catálogo até liberar a Jornada — até lá, confira os relatórios por prova.",
            impactoEstimado: "Baseado na conversa inicial com o copiloto",
            questsPendentes: [] as Array<{ id: string; titulo: string }>,
            temPlano: false,
          }
        : null;

    const base: JourneyInsight = {
      context: "JOURNEY",
      temDados: false,
      ...insightBase,
      focoPrincipal: null,
      focosSecundarios: [],
      principalGargalo: null,
      copiloto: null,
      temDiagnosticoEscopo: false,
      coberturaN2,
      principalAlavanca: null,
      focoSemana: null,
      missao: missaoAnamnese,
      estado: temRegistrosProva
        ? {
            tendencia: "inicio" as TendenciaJornada,
            tendenciaLabel:
              "Relatórios de prova disponíveis — a Jornada longitudinal abre após critérios de elegibilidade.",
            pctAcertoPonderado: resumo.pctAcertoPonderado,
            totalRegistros: resumo.totalRegistros,
            consistenciaLabel: `${resumo.totalRegistros} registro(s) — faltam evidências para a Jornada`,
            riscoLabel: "Sem diagnóstico longitudinal até iniciar a Jornada",
            recoveryMode: false,
            metaAlvo: resumo.metaAlvo || "Defina sua meta em Perfil",
          }
        : null,
      padraoCognitivo: null,
      diagnosticoIntegrado: null,
      alavancas: [],
      atividadesRecentes: temRegistrosProva
        ? analytics.registrosRecentes.slice(0, 4)
        : [],
      anamnese: anamneseCtx,
      focosPedagogicos: [],
      linhaAnamnese: linhaContrasteAnamneseEscopo(anamneseCtx, false, null),
    };

    return base;
  }

  if (resumo.totalRegistros === 0) {
    const missaoAnamnese =
      anamneseCtx.completed && anamneseCtx.focoInicialTitulo
        ? {
            focoTitulo: anamneseCtx.focoInicialTitulo,
            focoDescricao:
              anamneseCtx.focoInicialDescricao ??
              "Registre sua primeira prova do catálogo quando puder — até lá, siga o passo em Quests.",
            impactoEstimado: "Baseado na conversa inicial com o copiloto",
            questsPendentes: [] as Array<{ id: string; titulo: string }>,
            temPlano: Boolean(planoData.plan),
          }
        : null;

    const base: JourneyInsight = {
      context: "JOURNEY",
      temDados: false,
      ...insightBase,
      focoPrincipal: null,
      focosSecundarios: [],
      principalGargalo: null,
      copiloto: null,
      temDiagnosticoEscopo: false,
      coberturaN2,
      principalAlavanca: null,
      focoSemana: null,
      missao: missaoAnamnese,
      estado: null,
      padraoCognitivo: null,
      diagnosticoIntegrado: null,
      alavancas: [],
      atividadesRecentes: [],
      anamnese: anamneseCtx,
      focosPedagogicos,
      linhaAnamnese: linhaContrasteAnamneseEscopo(anamneseCtx, false, null),
    };

    if (usaIa && planoData.plan?.narrative) {
      aplicarNarrativaIa(base, planoData.plan.narrative);
    } else {
      await garantirQuestsAlavanca(userId, base);
    }

    const oQueFazer = await getOQueFazerAgora(userId);
    if (base.missao) {
      base.missao.questsPendentes = oQueFazer.map((q) => ({ id: q.id, titulo: q.titulo }));
    }

    return base;
  }

  const pctsRecentes = ultimosExams.map((e) => pctAcertoRegistro(e.questionAttempts));
  const { tendencia, label: tendenciaLabel } = calcularTendencia(pctsRecentes);
  const recoveryMode = ultimosExams[ultimosExams.length - 1]?.recoveryMode ?? false;

  const materiasBase = materiasComDadosReais(analytics.materiasMedia, 3);
  const alavancas = calcularAlavancas(materiasBase);
  const principalAlavanca = alavancas[0] ?? null;

  const focoPrincipal = focosPedagogicos[0] ?? null;
  const focosSecundarios = focosPedagogicos.slice(1, 3);
  const temDiagnosticoEscopo = focosPedagogicos.length > 0;

  let narrativa = focoPrincipal ? narrativaFromFoco(focoPrincipal) : null;

  if (cicloAtivo?.narrativaInicioJson && focoPrincipal) {
    try {
      const ni = JSON.parse(cicloAtivo.narrativaInicioJson) as {
        hipotese?: string;
        objetivo?: string;
      };
      const story = buildCicloInicioStory(cicloAtivo, ni);
      if (story.paragrafos.length) {
        narrativa = {
          ...narrativaFromFoco(focoPrincipal),
          paragrafo: story.paragrafos.join(" "),
        };
      }
    } catch {
      /* ignora */
    }
  }

  const principalGargalo: GargaloEscopoInsight | null = focoPrincipal
    ? {
        descricao: focoPrincipal.hipoteseCausa,
        escopoLabel: focoPrincipal.escopoLabel,
        materiaContexto: focoPrincipal.materiaLabel,
        pctAcertoEscopo: Math.round(focoPrincipal.taxaAcerto * 100),
        erros: focoPrincipal.totalErros,
        hipoteseCausa: focoPrincipal.hipoteseCausa,
        objetivoSemana: focoPrincipal.objetivoDaSemana,
        metadadosResumo: focoPrincipal.metadadosCognitivosResumo?.resumoTexto ?? null,
        materiaDeficitPrincipal: principalAlavanca?.label ?? null,
      }
    : null;

  const diagnosticoIntegrado: DiagnosticoIntegrado | null = focoPrincipal
    ? {
        titulo: focoPrincipal.escopoLabel,
        paragrafo: focoPrincipal.hipoteseCausa,
        lacunaChave: focoPrincipal.escopoId,
      }
    : null;

  const topAlavanca = alavancas[0];

  const missaoDraft =
    focoPrincipal || topAlavanca
      ? {
          focoTitulo:
            focoPrincipal?.escopoLabel ??
            (topAlavanca ? `Reforço: ${topAlavanca.label}` : "Missão da semana"),
          focoDescricao:
            focoPrincipal?.objetivoDaSemana ??
            topAlavanca?.mensagem ??
            "Abra suas quests e siga o passo da semana.",
          impactoEstimado: focoPrincipal?.hipoteseCausa ?? null,
          questsPendentes: [] as Array<{ id: string; titulo: string }>,
          temPlano: Boolean(planoData.plan),
        }
      : null;

  let riscoLabel = "Risco baixo nesta fase";
  if (recoveryMode) riscoLabel = "Modo recuperação — ritmo mais leve recomendado";
  else if (tendencia === "cuidado") riscoLabel = "Atenção: último registro abaixo do anterior";
  else if (resumo.pctAcertoPonderado < 55) riscoLabel = "Desempenho global pede reforço de base";

  let consistenciaLabel = `${resumo.totalRegistros} registro(s) na jornada`;
  if (resumo.totalRegistros >= 3) consistenciaLabel = "Você está construindo histórico — bom para o plano";

  const focoSemana =
    focoPrincipal?.escopoLabel ?? missaoDraft?.focoTitulo ?? principalAlavanca?.label ?? null;

  const insightSemQuests: JourneyInsight = {
    context: "JOURNEY",
    temDados: jornadaIniciada && temPlanoJornadaAtivo,
    ...insightBase,
    focoPrincipal,
    focosSecundarios,
    principalGargalo,
    copiloto: narrativa,
    temDiagnosticoEscopo,
    coberturaN2,
    principalAlavanca,
    focoSemana,
    missao: missaoDraft,
    estado: {
      tendencia,
      tendenciaLabel,
      pctAcertoPonderado: resumo.pctAcertoPonderado,
      totalRegistros: resumo.totalRegistros,
      consistenciaLabel,
      riscoLabel,
      recoveryMode,
      metaAlvo: resumo.metaAlvo || "Defina sua meta em Perfil",
    },
    padraoCognitivo: metacognicao
      ? {
          insight: metacognicao.insight,
          causaDominante: metacognicao.causaDominante?.label ?? null,
          pctErrosClassificados: metacognicao.pctErrosClassificados,
        }
      : null,
    diagnosticoIntegrado,
    alavancas,
    atividadesRecentes: analytics.registrosRecentes.slice(0, 4),
    anamnese: anamneseCtx,
    focosPedagogicos,
    linhaAnamnese: linhaContrasteAnamneseEscopo(anamneseCtx, true, focoPrincipal),
  };

  if (usaIa && planoData.plan?.narrative) {
    aplicarNarrativaIa(insightSemQuests, planoData.plan.narrative);
  } else {
    await garantirQuestsAlavanca(userId, insightSemQuests);
  }

  const oQueFazer = await getOQueFazerAgora(userId);
  if (insightSemQuests.missao) {
    insightSemQuests.missao.questsPendentes = oQueFazer.map((q) => ({
      id: q.id,
      titulo: q.titulo,
    }));
  }

  return insightSemQuests;
}

function aplicarNarrativaIa(insight: JourneyInsight, narrativa: CopilotoNarrativa): void {
  insight.copiloto = {
    titulo: narrativa.diagnosticoTitulo,
    paragrafo: narrativa.diagnosticoParagrafo,
    camadas: narrativa.camadas ?? {
      oQueAcontece: narrativa.diagnosticoParagrafo,
      comoCognitivo: "",
      quandoAparece: "",
      naoSignifica: "",
      caminho: narrativa.missaoDescricao,
    },
    linhaFoco: narrativa.missaoImpacto ?? "",
    proximoPasso: narrativa.missaoDescricao,
  };

  insight.diagnosticoIntegrado = {
    titulo: narrativa.diagnosticoTitulo,
    paragrafo: narrativa.diagnosticoParagrafo,
    lacunaChave: insight.focoPrincipal?.escopoId ?? "ia",
  };

  const base = insight.principalGargalo;
  insight.principalGargalo = {
    descricao: narrativa.diagnosticoParagrafo,
    escopoLabel: base?.escopoLabel ?? narrativa.diagnosticoTitulo,
    materiaContexto: base?.materiaContexto ?? null,
    pctAcertoEscopo: base?.pctAcertoEscopo ?? null,
    erros: base?.erros ?? 0,
    hipoteseCausa: base?.hipoteseCausa ?? null,
    objetivoSemana: base?.objetivoSemana ?? null,
    metadadosResumo: base?.metadadosResumo ?? null,
    materiaDeficitPrincipal: base?.materiaDeficitPrincipal ?? null,
  };

  insight.missao = {
    focoTitulo: narrativa.missaoTitulo,
    focoDescricao: narrativa.missaoDescricao,
    impactoEstimado: narrativa.missaoImpacto,
    questsPendentes: insight.missao?.questsPendentes ?? [],
    temPlano: true,
  };

  if (narrativa.linhaAnamnese) {
    insight.linhaAnamnese = narrativa.linhaAnamnese;
  }
}
