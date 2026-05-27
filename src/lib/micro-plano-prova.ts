import { attemptsPonderadosJornada, buildDiagnosisForProva } from "@/lib/jornada-diagnostico";
import { aplicarPlanoCoachIA } from "@/lib/diagnosis";
import { prisma } from "@/lib/prisma";
import { generateStudyPlan, planToQuests } from "@/lib/study-plan";
import type { StudyPlanItem } from "@/lib/study-plan";

export async function gerarMicroPlanoProva(userId: string, provaId: string) {
  const prova = await prisma.prova.findFirst({
    where: { id: provaId, publicada: true },
  });
  if (!prova) return { error: "PROVA_NOT_FOUND" as const };

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

  let items: StudyPlanItem[] =
    withIA.aiStudyPlanItems?.length
      ? withIA.aiStudyPlanItems
      : generateStudyPlan(withIA, { ehProvaOficial: true }).items;

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

  return { plan, items, diagnosis: withIA };
}
