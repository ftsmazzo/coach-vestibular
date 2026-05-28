/**
 * Síntese pedagógica da Home — contexto JOURNEY apenas.
 * Sem comparações entre provas/bancas diferentes (isso fica em BOARD / EXAM).
 */
import type { RegistroDashboardCard } from "@/lib/jornada-analytics";
import { aggregateJourneyLearning, materiasComDadosReais } from "@/lib/jornada-analytics";
import { aggregateKnowledgeGaps, type LacunaConhecimento } from "@/lib/knowledge-gaps";
import { buildDiagnosticoMotor, type ClusterAgregado } from "@/lib/diagnostic-motor";
import { narrativaCopiloto } from "@/lib/narrativa-copiloto";
import { buildMetacognicaoGlobalJornada } from "@/lib/jornada-metacognicao";
import { buildResumoJornada } from "@/lib/jornada";
import { getPlanoAtual } from "@/lib/plano-atual";
import {
  garantirQuestsAlavanca,
  getQuestsAlavancaPendentes,
} from "@/lib/quests-alavanca";
import { pctAcertoRegistro } from "@/lib/exam-stats";
import { prisma } from "@/lib/prisma";

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
  /** Clusters com priorityScore — inferência antes da narrativa */
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
};

export type { ClusterAgregado, LacunaConhecimento };

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
    ultimosExams,
  ] = await Promise.all([
      buildResumoJornada(userId),
      buildMetacognicaoGlobalJornada(userId),
      getPlanoAtual(userId),
      aggregateJourneyLearning(userId, "todos"),
      aggregateKnowledgeGaps(userId, 5),
      buildDiagnosticoMotor(userId),
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

  if (resumo.totalRegistros === 0) {
    return {
      context: "JOURNEY",
      temDados: false,
      principalGargalo: null,
      clustersPedagogicos: [],
      temDiagnosticoCognitivo: false,
      principalAlavanca: null,
      focoSemana: null,
      missao: null,
      estado: null,
      padraoCognitivo: null,
      diagnosticoIntegrado: null,
      alavancas: [],
      lacunasConhecimento: [],
      atividadesRecentes: [],
    };
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
      ? narrativaCopiloto(principalCluster, materiaDeficit, motor.totalExames)
      : null;

  const principalGargalo: GargaloCognitivoInsight | null =
    principalCluster && narrativa
      ? {
          descricao: narrativa.paragrafo,
          tipoLabel: principalCluster.label,
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

  const itemFoco =
    planoData.items.find((i) => i.bloco === "analise_materia") ??
    planoData.items.find((i) => i.geraQuest !== false && i.duracaoMin > 0) ??
    planoData.items[0];

  const topAlavanca = alavancas[0];

  const missaoDraft =
    itemFoco || narrativa || topAlavanca
      ? {
          focoTitulo:
            narrativa?.titulo ??
            itemFoco?.titulo ??
            (topAlavanca ? `Reforço: ${topAlavanca.label}` : "Missão da semana"),
          focoDescricao:
            narrativa?.proximoPasso ??
            itemFoco?.descricao?.slice(0, 280) ??
            topAlavanca?.mensagem ??
            "Abra suas quests de alavanca e siga o passo da semana.",
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
    principalGargalo?.tipoLabel ?? missao?.focoTitulo ?? principalAlavanca?.label ?? null;

  const insightSemQuests: JourneyInsight = {
    context: "JOURNEY",
    temDados: true,
    principalGargalo,
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
  };

  await garantirQuestsAlavanca(userId, insightSemQuests);
  const questsAlavanca = await getQuestsAlavancaPendentes(userId);

  if (insightSemQuests.missao) {
    insightSemQuests.missao.questsPendentes = questsAlavanca.slice(0, 3).map((q) => ({
      id: q.id,
      titulo: q.titulo.replace(/^\[Alavanca\]\s*/, ""),
    }));
  }

  return insightSemQuests;
}
