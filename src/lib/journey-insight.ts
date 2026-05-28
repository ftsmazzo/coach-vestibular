/**
 * Síntese pedagógica da Home — contexto JOURNEY apenas.
 * Sem comparações entre provas/bancas diferentes (isso fica em BOARD / EXAM).
 */
import type { RegistroDashboardCard } from "@/lib/jornada-analytics";
import { aggregateJourneyLearning, materiasComDadosReais } from "@/lib/jornada-analytics";
import {
  aggregateCognitiveClusters,
  aggregateKnowledgeGaps,
  type ClusterCognitivo,
  type LacunaConhecimento,
} from "@/lib/knowledge-gaps";
import { fraseGargaloCognitivo, tituloMissaoCognitiva } from "@/lib/tipo-cognitivo";
import { buildMetacognicaoGlobalJornada } from "@/lib/jornada-metacognicao";
import { buildResumoJornada } from "@/lib/jornada";
import { getPlanoAtual, getQuestsDoPlanoAtual } from "@/lib/plano-atual";
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
  erros: number;
  exemploConhecimento: string | null;
};

export type JourneyInsight = {
  context: "JOURNEY";
  temDados: boolean;
  /** Eixo principal — operação cognitiva, não matéria */
  principalGargalo: GargaloCognitivoInsight | null;
  clustersCognitivos: ClusterCognitivo[];
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
  alavancas: AlavancaJornada[];
  lacunasConhecimento: LacunaConhecimento[];
  atividadesRecentes: RegistroDashboardCard[];
};

export type { ClusterCognitivo, LacunaConhecimento };

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
    questsData,
    analytics,
    lacunasConhecimento,
    clustersCognitivos,
    ultimosExams,
  ] = await Promise.all([
      buildResumoJornada(userId),
      buildMetacognicaoGlobalJornada(userId),
      getPlanoAtual(userId),
      getQuestsDoPlanoAtual(userId),
      aggregateJourneyLearning(userId, "todos"),
      aggregateKnowledgeGaps(userId, 5),
      aggregateCognitiveClusters(userId, 4),
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
      clustersCognitivos: [],
      temDiagnosticoCognitivo: false,
      principalAlavanca: null,
      focoSemana: null,
      missao: null,
      estado: null,
      padraoCognitivo: null,
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
  const topCluster = clustersCognitivos[0] ?? null;
  const topLacuna = lacunasConhecimento[0] ?? null;
  const temDiagnosticoCognitivo = lacunasConhecimento.length > 0;

  const principalGargalo: GargaloCognitivoInsight | null = topCluster
    ? {
        descricao: fraseGargaloCognitivo(topCluster),
        tipoLabel: topCluster.label,
        materiaContexto: topCluster.materias[0] ?? topLacuna?.materia ?? null,
        erros: topCluster.erros,
        exemploConhecimento: topCluster.exemplosConhecimento[0] ?? null,
      }
    : topLacuna
      ? {
          descricao: `Lacuna em ${topLacuna.tipoCognitivoLabel.toLowerCase()}: ${topLacuna.texto}`,
          tipoLabel: topLacuna.tipoCognitivoLabel,
          materiaContexto: topLacuna.materia,
          erros: topLacuna.erros,
          exemploConhecimento: topLacuna.texto,
        }
      : null;

  const itemFoco =
    planoData.items.find((i) => i.bloco === "analise_materia") ??
    planoData.items.find((i) => i.geraQuest !== false && i.duracaoMin > 0) ??
    planoData.items[0];

  const topAlavanca = alavancas[0];
  const questsPendentes = questsData.quests
    .filter((q) => q.status === "pending")
    .slice(0, 3)
    .map((q) => ({ id: q.id, titulo: q.titulo }));

  const missao =
    itemFoco || questsPendentes.length > 0 || topCluster || topLacuna || topAlavanca
      ? {
          focoTitulo:
            (topCluster && temDiagnosticoCognitivo
              ? tituloMissaoCognitiva(topCluster)
              : null) ??
            itemFoco?.titulo ??
            (topLacuna
              ? `Treinar: ${topLacuna.tipoCognitivoLabel}`
              : topAlavanca
                ? `Contexto: ${topAlavanca.label}`
                : "Missão da semana"),
          focoDescricao:
            (topCluster && temDiagnosticoCognitivo
              ? `${fraseGargaloCognitivo(topCluster)} Exemplo do que a banca cobrou: «${topCluster.exemplosConhecimento[0]}».`
              : null) ??
            itemFoco?.descricao?.slice(0, 280) ??
            topLacuna?.texto ??
            topAlavanca?.mensagem ??
            "Abra suas quests e siga o plano da semana.",
          impactoEstimado: topCluster
            ? `${topCluster.erros} erro${topCluster.erros !== 1 ? "s" : ""} neste tipo cognitivo na jornada`
            : topLacuna
              ? `Operação: ${topLacuna.tipoCognitivoLabel}`
              : topAlavanca?.potencial === "alto"
                ? `Contexto curricular: ${topAlavanca.label}`
                : null,
          questsPendentes,
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

  return {
    context: "JOURNEY",
    temDados: true,
    principalGargalo,
    clustersCognitivos,
    temDiagnosticoCognitivo,
    principalAlavanca,
    focoSemana,
    missao,
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
    alavancas,
    lacunasConhecimento,
    atividadesRecentes: analytics.registrosRecentes.slice(0, 4),
  };
}
