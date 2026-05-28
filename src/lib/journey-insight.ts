/**
 * Síntese pedagógica da Home — contexto JOURNEY apenas.
 * Sem comparações entre provas/bancas diferentes (isso fica em BOARD / EXAM).
 */
import type { RegistroDashboardCard } from "@/lib/jornada-analytics";
import { aggregateJourneyLearning, materiasComDadosReais } from "@/lib/jornada-analytics";
import { aggregateKnowledgeGaps, type LacunaConhecimento } from "@/lib/knowledge-gaps";
import { buildDiagnosticoMotor, type ClusterAgregado } from "@/lib/diagnostic-motor";
import { narrativaCopiloto, type NarrativaCopiloto } from "@/lib/narrativa-copiloto";
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
import { linhaContrasteAnamnese } from "@/lib/anamnese-contexto";
import type { AnamneseMotorContext } from "@/lib/anamnese-types";
import type { CopilotoNarrativa } from "@/lib/copiloto-ia-types";

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

export type GargaloCognitivoInsight = {
  descricao: string;
  tipoLabel: string;
  materiaContexto: string | null;
  pctAcertoMateria: number | null;
  erros: number;
  exemploConhecimento: string | null;
  causaMetacognitiva: string | null;
  pctCausaMetacognitiva: number | null;
  materiaDeficitPrincipal: string | null;
};

export type DiagnosticoIntegrado = {
  titulo: string;
  paragrafo: string;
  lacunaChave: string;
};

export type JourneyInsight = {
  context: "JOURNEY";
  temDados: boolean;
  /** Eixo principal — operação cognitiva, não matéria */
  principalGargalo: GargaloCognitivoInsight | null;
  /** Texto copiloto (camadas narrativas) */
  copiloto: NarrativaCopiloto | null;
  clustersPedagogicos: ClusterAgregado[];
  temDiagnosticoCognitivo: boolean;
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
  lacunasConhecimento: LacunaConhecimento[];
  atividadesRecentes: RegistroDashboardCard[];
  anamnese: AnamneseMotorContext;
  /** Linha extra quando anamnese cruza com jornada */
  linhaAnamnese: string | null;
};

export type { ClusterAgregado, LacunaConhecimento, NarrativaCopiloto };

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

export async function buildJourneyInsight(userId: string): Promise<JourneyInsight> {
  const [
    resumo,
    metacognicao,
    planoData,
    analytics,
    lacunasConhecimento,
    motor,
    anamneseCtx,
    ultimosExams,
  ] = await Promise.all([
      buildResumoJornada(userId),
      buildMetacognicaoGlobalJornada(userId),
      getPlanoAtual(userId),
      aggregateJourneyLearning(userId, "todos"),
      aggregateKnowledgeGaps(userId, 5),
      buildDiagnosticoMotor(userId),
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
    ]);

  const usaIa =
    planoData.plan?.fonteGeracao === "ia" && Boolean(planoData.plan?.narrative);

  if (resumo.totalRegistros === 0) {
    const missaoAnamnese =
      anamneseCtx.completed && anamneseCtx.focoInicialTitulo
        ? {
            focoTitulo: anamneseCtx.focoInicialTitulo,
            focoDescricao:
              anamneseCtx.focoInicialDescricao ??
              "Registre sua primeira atividade quando puder — até lá, siga o passo em Quests.",
            impactoEstimado: "Baseado na conversa inicial com o copiloto",
            questsPendentes: [] as Array<{ id: string; titulo: string }>,
            temPlano: Boolean(planoData.plan),
          }
        : null;

    const base: JourneyInsight = {
      context: "JOURNEY",
      temDados: false,
      principalGargalo: null,
      copiloto: null,
      clustersPedagogicos: [],
      temDiagnosticoCognitivo: false,
      principalAlavanca: null,
      focoSemana: null,
      missao: missaoAnamnese,
      estado: null,
      padraoCognitivo: null,
      diagnosticoIntegrado: null,
      alavancas: [],
      lacunasConhecimento: [],
      atividadesRecentes: [],
      anamnese: anamneseCtx,
      linhaAnamnese: linhaContrasteAnamnese(anamneseCtx, false),
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
  const clustersPedagogicos = motor.clusters;
  const temDiagnosticoCognitivo = motor.temDados;
  const principalCluster = motor.clusterPrincipal;
  const materiaDeficit = motor.materiaDeficit;

  const narrativa =
    principalCluster && temDiagnosticoCognitivo
      ? narrativaCopiloto(principalCluster, materiaDeficit, motor.totalExames, anamneseCtx)
      : null;

  const principalGargalo: GargaloCognitivoInsight | null =
    principalCluster && narrativa
      ? {
          descricao: narrativa.paragrafo,
          tipoLabel: narrativa.titulo,
          materiaContexto: principalCluster.materias[0]?.nome ?? null,
          pctAcertoMateria:
            principalCluster.materias[0]?.pctAcerto ??
            materiaDeficit?.pct ??
            null,
          erros: principalCluster.erros,
          exemploConhecimento: narrativa.exemploConcreto,
          causaMetacognitiva: narrativa.causaComoVoceErra,
          pctCausaMetacognitiva: principalCluster.causaDominante?.pct ?? null,
          materiaDeficitPrincipal: materiaDeficit?.label ?? null,
        }
      : null;

  const diagnosticoIntegrado: DiagnosticoIntegrado | null =
    narrativa && principalCluster
      ? {
          titulo: narrativa.titulo,
          paragrafo: narrativa.paragrafo,
          lacunaChave: principalCluster.clusterId,
        }
      : null;

  const topAlavanca = alavancas[0];

  const missaoDraft =
    narrativa || topAlavanca
      ? {
          focoTitulo:
            narrativa?.titulo ??
            (topAlavanca ? `Reforço: ${topAlavanca.label}` : "Missão da semana"),
          focoDescricao:
            narrativa?.proximoPasso ??
            topAlavanca?.mensagem ??
            "Abra suas quests e siga o passo da semana.",
          impactoEstimado: narrativa?.linhaFoco ?? null,
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
    principalGargalo?.tipoLabel ?? missaoDraft?.focoTitulo ?? principalAlavanca?.label ?? null;

  const insightSemQuests: JourneyInsight = {
    context: "JOURNEY",
    temDados: true,
    principalGargalo,
    copiloto: narrativa,
    clustersPedagogicos,
    temDiagnosticoCognitivo,
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
    lacunasConhecimento,
    atividadesRecentes: analytics.registrosRecentes.slice(0, 4),
    anamnese: anamneseCtx,
    linhaAnamnese: linhaContrasteAnamnese(anamneseCtx, true),
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

/** Sobrepõe os campos narrativos do insight com a narrativa gravada (IA). */
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
    exemploConcreto: null,
    causaComoVoceErra: null,
  };

  insight.diagnosticoIntegrado = {
    titulo: narrativa.diagnosticoTitulo,
    paragrafo: narrativa.diagnosticoParagrafo,
    lacunaChave: "ia",
  };

  const base = insight.principalGargalo;
  insight.principalGargalo = {
    descricao: narrativa.diagnosticoParagrafo,
    tipoLabel: narrativa.diagnosticoTitulo,
    materiaContexto: base?.materiaContexto ?? null,
    pctAcertoMateria: base?.pctAcertoMateria ?? null,
    erros: base?.erros ?? 0,
    exemploConhecimento: base?.exemploConhecimento ?? null,
    causaMetacognitiva: base?.causaMetacognitiva ?? null,
    pctCausaMetacognitiva: base?.pctCausaMetacognitiva ?? null,
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
