import { prisma } from "./prisma";
import type { StudyPlanItem } from "./study-plan";

export interface PlanoAtualData {
  plan: {
    id: string;
    recoveryMode: boolean;
    createdAt: Date;
  } | null;
  items: StudyPlanItem[];
  titulosQuests: Set<string>;
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
      ? { id: plan.id, recoveryMode: plan.recoveryMode, createdAt: plan.createdAt }
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
