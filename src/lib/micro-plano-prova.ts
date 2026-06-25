import { attemptsPonderadosJornada, buildDiagnosisForProva } from "@/lib/jornada-diagnostico";
import { aplicarPlanoCoachIA } from "@/lib/diagnosis";
import { prisma } from "@/lib/prisma";
import { planToQuests } from "@/lib/study-plan";
import type { StudyPlanItem } from "@/lib/study-plan";
import type { CopilotoNarrativa } from "@/lib/copiloto-ia-types";

/** Lê o micro-plano salvo desta prova (escopo PROVA), com narrativa IA se houver. */
export async function getMicroPlanoProva(userId: string, provaId: string) {
  const plan = await prisma.studyPlan.findFirst({
    where: { userId, provaId, escopo: "PROVA" },
    orderBy: { createdAt: "desc" },
  });
  if (!plan) return { plan: null, items: [] as StudyPlanItem[], narrative: null };

  let narrative: CopilotoNarrativa | null = null;
  if (plan.narrativeJson) {
    try {
      const parsed = JSON.parse(plan.narrativeJson) as CopilotoNarrativa & { _conjunto?: unknown };
      if (parsed._conjunto) {
        return { plan: null, items: [] as StudyPlanItem[], narrative: null };
      }
      narrative = parsed as CopilotoNarrativa;
    } catch {
      narrative = null;
    }
  }

  return {
    plan: {
      id: plan.id,
      createdAt: plan.createdAt,
      fonteGeracao: plan.fonteGeracao ?? "template",
      recoveryMode: plan.recoveryMode,
    },
    items: JSON.parse(plan.itemsJson) as StudyPlanItem[],
    narrative,
  };
}

/** Arquiva quests pendentes desta prova (pelo prefixo) antes de recriar. */
async function arquivarQuestsDaProva(userId: string, nomeProva: string) {
  const prefix = `[${nomeProva.slice(0, 20)}]`;
  const pendentes = await prisma.quest.findMany({
    where: { userId, status: "pending" },
    select: { id: true, titulo: true },
  });
  const ids = pendentes.filter((q) => q.titulo.startsWith(prefix)).map((q) => q.id);
  if (ids.length > 0) {
    await prisma.quest.updateMany({
      where: { id: { in: ids } },
      data: { status: "skipped" },
    });
  }
}

export async function gerarMicroPlanoProva(userId: string, provaId: string) {
  const prova = await prisma.prova.findFirst({
    where: { id: provaId, publicada: true },
  });
  if (!prova) return { error: "PROVA_NOT_FOUND" as const };

  // Caminho IA: diagnóstico + micro-plano + quests específicos da prova.
  const { gerarProvaIA } = await import("@/lib/prova-ia");
  const ia = await gerarProvaIA(userId, provaId);
  if (ia) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);

    await arquivarQuestsDaProva(userId, prova.nome);
    await prisma.studyPlan.deleteMany({ where: { userId, provaId, escopo: "PROVA" } });

    const plan = await prisma.studyPlan.create({
      data: {
        userId,
        provaId,
        escopo: "PROVA",
        weekStart,
        itemsJson: JSON.stringify(ia.planoItems),
        narrativeJson: JSON.stringify(ia.narrativa),
        fonteGeracao: "ia",
        recoveryMode: ia.recoveryMode,
      },
    });

    if (ia.quests.length > 0) {
      await prisma.quest.createMany({
        data: ia.quests.map((q) => ({
          userId,
          titulo: q.titulo,
          descricao: q.descricao,
          duracaoMin: q.duracaoMin,
          rewardMsg: "Foco só desta prova — corrija cada erro na hora.",
        })),
      });
    }

    return {
      plan,
      items: ia.planoItems,
      fonte: "ia" as const,
      questsCount: ia.quests.length,
    };
  }

  const diagnosis = await buildDiagnosisForProva(userId, provaId);
  if (!diagnosis) return { error: "SEM_REGISTROS" as const };

  const exams = await prisma.exam.findMany({
    where: { userId, provaId },
    include: { questionAttempts: { include: { provaQuestao: true } } },
  });
  const attempts = attemptsPonderadosJornada(exams);

  const withIA = await aplicarPlanoCoachIA(diagnosis, attempts, {
    examLabel: `${prova.nome} (foco)`,
  });

  let items: StudyPlanItem[] = withIA.aiStudyPlanItems ?? [];

  items = [
    {
      ordem: 0,
      titulo: `Micro-plano — ${prova.nome}`,
      descricao:
        "Foco só nesta prova do catálogo, usando todas as suas tentativas registradas. " +
        "Complementa o plano global da semana.",
      duracaoMin: 0,
      bloco: "contexto",
      geraQuest: false,
    },
    ...items.map((it, i) => ({ ...it, ordem: i + 1 })),
  ];

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);

  await arquivarQuestsDaProva(userId, prova.nome);
  await prisma.studyPlan.deleteMany({
    where: { userId, provaId, escopo: "PROVA" },
  });

  const plan = await prisma.studyPlan.create({
    data: {
      userId,
      provaId,
      escopo: "PROVA",
      weekStart,
      itemsJson: JSON.stringify(items),
      fonteGeracao: "template",
      recoveryMode: withIA.recoveryMode,
    },
  });

  const questData = planToQuests(
    items.filter((i) => i.geraQuest !== false && i.duracaoMin > 0),
    userId
  ).map((q) => ({
    ...q,
    titulo: `[${prova.nome.slice(0, 20)}] ${q.titulo}`,
  }));

  if (questData.length > 0) {
    await prisma.quest.createMany({ data: questData });
  }

  return {
    plan,
    items,
    diagnosis: withIA,
    fonte: "template" as const,
    questsCount: questData.length,
  };
}
