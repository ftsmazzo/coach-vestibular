import { prisma } from "./prisma";
import type { StudyPlanItem } from "./study-plan";
import { isQuestAlavanca } from "./quests-alavanca";
import type { CopilotoNarrativa } from "./copiloto-ia-types";
import {
  buscarPlanoSemanalPorCiclo,
  buscarQuestsJornadaPorCiclo,
  isQuestJornadaMotor,
  parseStudyPlanJornadaItems,
  ESCOPO_JORNADA_SEMANAL,
  FONTE_GERACAO_JORNADA_V1,
  type StudyPlanJornadaItems,
  type StudyPlanJornadaNarrative,
} from "./jornada-plano-semanal";
import { buscarCicloSemana1Jornada } from "./jornada-ciclo-inicial";

export interface PlanoAtualData {
  plan: {
    id: string;
    recoveryMode: boolean;
    createdAt: Date;
    fonteGeracao: string | null;
    narrative: CopilotoNarrativa | null;
  } | null;
  items: StudyPlanItem[];
  titulosQuests: Set<string>;
}

function parseNarrative(raw: string | null): CopilotoNarrativa | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as CopilotoNarrativa;
  } catch {
    return null;
  }
}

export async function getPlanoAtual(userId: string): Promise<PlanoAtualData> {
  const plan = await prisma.studyPlan.findFirst({
    where: { userId, escopo: "GLOBAL" },
    orderBy: { createdAt: "desc" },
  });

  const items: StudyPlanItem[] = plan ? JSON.parse(plan.itemsJson) : [];
  const titulosQuests = new Set(
    items
      .filter((i) => i.geraQuest !== false && i.duracaoMin > 0)
      .map((i) => i.titulo)
  );

  return {
    plan: plan
      ? {
          id: plan.id,
          recoveryMode: plan.recoveryMode,
          createdAt: plan.createdAt,
          fonteGeracao: plan.fonteGeracao ?? "template",
          narrative: parseNarrative(plan.narrativeJson),
        }
      : null,
    items,
    titulosQuests,
  };
}

/** Quests alinhadas ao plano mais recente (esconde lixo de planos antigos). */
export async function getQuestsDoPlanoAtual(userId: string) {
  const { plan, items, titulosQuests } = await getPlanoAtual(userId);
  const ordemPorTitulo = new Map(items.map((i) => [i.titulo, i.ordem]));

  const todas = await prisma.quest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const filtradas = todas.filter((q) => {
    if (isQuestAlavanca(q.titulo)) return false;
    // Quests com prefixo [Prova] são do escopo PROVA — só aparecem na visão da prova,
    // nunca na lista global (senão a Home as trata como "planos antigos").
    if (q.titulo.startsWith("[")) return false;
    if (q.status !== "pending") return true;
    if (!plan) return false;
    if (titulosQuests.has(q.titulo)) return true;
    if (q.createdAt >= plan.createdAt) return true;
    return false;
  });

  filtradas.sort((a, b) => {
    if (a.status !== b.status) return a.status === "pending" ? -1 : 1;
    const oa = ordemPorTitulo.get(a.titulo) ?? 999;
    const ob = ordemPorTitulo.get(b.titulo) ?? 999;
    return oa - ob;
  });

  return { quests: filtradas, plan, items };
}

/** Quests do micro-plano de uma prova (escopo PROVA). */
export async function getQuestsDaProva(userId: string, provaId: string) {
  const prova = await prisma.prova.findUnique({
    where: { id: provaId },
    select: { nome: true },
  });
  const plan = await prisma.studyPlan.findFirst({
    where: { userId, provaId, escopo: "PROVA" },
    orderBy: { createdAt: "desc" },
  });

  const prefix = prova ? `[${prova.nome.slice(0, 20)}]` : "";
  const items: StudyPlanItem[] = plan ? JSON.parse(plan.itemsJson) : [];
  const titulosPlano = new Set(
    items
      .filter((i) => i.geraQuest !== false && i.duracaoMin > 0)
      .map((i) => (prefix ? `${prefix} ${i.titulo}` : i.titulo))
  );

  const todas = await prisma.quest.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const quests = todas.filter((q) => {
    if (titulosPlano.has(q.titulo)) return true;
    if (prefix && q.titulo.startsWith(prefix)) return true;
    return false;
  });

  return { quests, plan, prova, items };
}

export type PlanoJornadaSemanalData = {
  plan: {
    id: string;
    recoveryMode: boolean;
    createdAt: Date;
    weekStart: Date;
  } | null;
  items: StudyPlanJornadaItems | null;
  narrative: StudyPlanJornadaNarrative | null;
};

export async function getPlanoJornadaSemanal(userId: string): Promise<PlanoJornadaSemanalData> {
  const ciclo = await buscarCicloSemana1Jornada(userId);
  if (!ciclo || ciclo.status !== "ATIVO") {
    return { plan: null, items: null, narrative: null };
  }

  const plan = await buscarPlanoSemanalPorCiclo(userId, ciclo.id);
  if (!plan) return { plan: null, items: null, narrative: null };

  let narrative: StudyPlanJornadaNarrative | null = null;
  if (plan.narrativeJson) {
    try {
      narrative = JSON.parse(plan.narrativeJson) as StudyPlanJornadaNarrative;
    } catch {
      narrative = null;
    }
  }

  return {
    plan: {
      id: plan.id,
      recoveryMode: plan.recoveryMode,
      createdAt: plan.createdAt,
      weekStart: plan.weekStart,
    },
    items: parseStudyPlanJornadaItems(plan.itemsJson),
    narrative,
  };
}

/** Quests do motor jornada-v1 vinculadas ao ciclo ativo — não mistura com PROVA/copiloto. */
export async function getQuestsJornadaSemanal(userId: string) {
  const ciclo = await buscarCicloSemana1Jornada(userId);
  if (!ciclo || ciclo.status !== "ATIVO") {
    return { quests: [], cicloId: null as string | null, plan: null };
  }

  const [quests, plan] = await Promise.all([
    buscarQuestsJornadaPorCiclo(userId, ciclo.id),
    prisma.studyPlan.findFirst({
      where: {
        userId,
        escopo: ESCOPO_JORNADA_SEMANAL,
        fonteGeracao: FONTE_GERACAO_JORNADA_V1,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const motor = quests.filter(isQuestJornadaMotor);
  const planoCiclo = plan ? parseStudyPlanJornadaItems(plan.itemsJson) : null;
  const planoOk = planoCiclo?.cicloId === ciclo.id ? plan : null;

  return {
    quests: motor,
    cicloId: ciclo.id,
    plan: planoOk,
  };
}
