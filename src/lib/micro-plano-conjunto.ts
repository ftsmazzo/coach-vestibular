import type { CopilotoNarrativa } from "@/lib/copiloto-ia-types";
import { loadConjuntoExamView } from "@/lib/conjunto-exam-view";
import { aplicarPlanoCoachIA } from "@/lib/diagnosis";
import { buildDiagnosisForConjunto, attemptsPonderadosJornada } from "@/lib/jornada-diagnostico";
import { prisma } from "@/lib/prisma";
import { parseConjuntoExamId } from "@/lib/prova-multidia";
import { generateStudyPlan, planToQuests, type StudyPlanItem } from "@/lib/study-plan";

export type ConjuntoPlanMeta = {
  conjuntoExamId: string;
  examIds: [string, string];
  provaIds: [string, string];
};

function extractConjuntoMeta(narrativeJson: string | null): ConjuntoPlanMeta | null {
  if (!narrativeJson) return null;
  try {
    const parsed = JSON.parse(narrativeJson) as CopilotoNarrativa & { _conjunto?: ConjuntoPlanMeta };
    return parsed._conjunto ?? null;
  } catch {
    return null;
  }
}

function wrapNarrative(narrativa: CopilotoNarrativa, meta: ConjuntoPlanMeta): string {
  return JSON.stringify({ ...narrativa, _conjunto: meta });
}

function parseNarrative(stored: string | null): {
  narrative: CopilotoNarrativa | null;
  meta: ConjuntoPlanMeta | null;
} {
  if (!stored) return { narrative: null, meta: null };
  try {
    const parsed = JSON.parse(stored) as CopilotoNarrativa & { _conjunto?: ConjuntoPlanMeta };
    const { _conjunto, ...narrativa } = parsed;
    return { narrative: narrativa as CopilotoNarrativa, meta: _conjunto ?? null };
  } catch {
    return { narrative: null, meta: null };
  }
}

export async function getMicroPlanoConjunto(userId: string, conjuntoExamId: string) {
  const ids = parseConjuntoExamId(conjuntoExamId);
  if (!ids) return { plan: null, items: [] as StudyPlanItem[], narrative: null };

  const conjunto = await loadConjuntoExamView(userId, ids[0], ids[1]);
  if (!conjunto) return { plan: null, items: [] as StudyPlanItem[], narrative: null };

  const plans = await prisma.studyPlan.findMany({
    where: { userId, provaId: conjunto.provaIds[0], escopo: "PROVA" },
    orderBy: { createdAt: "desc" },
  });

  const plan = plans.find((p) => extractConjuntoMeta(p.narrativeJson)?.conjuntoExamId === conjuntoExamId);
  if (!plan) return { plan: null, items: [] as StudyPlanItem[], narrative: null };

  const { narrative } = parseNarrative(plan.narrativeJson);

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

async function arquivarQuestsConjunto(userId: string, prefixo: string) {
  const pendentes = await prisma.quest.findMany({
    where: { userId, status: "pending" },
    select: { id: true, titulo: true },
  });
  const ids = pendentes.filter((q) => q.titulo.startsWith(prefixo)).map((q) => q.id);
  if (ids.length > 0) {
    await prisma.quest.updateMany({
      where: { id: { in: ids } },
      data: { status: "skipped" },
    });
  }
}

export async function gerarMicroPlanoConjunto(userId: string, conjuntoExamId: string) {
  const parsed = parseConjuntoExamId(conjuntoExamId);
  if (!parsed) return { error: "CONJUNTO_INVALIDO" as const };

  const [examIdDia1, examIdDia2] = parsed;
  const conjunto = await loadConjuntoExamView(userId, examIdDia1, examIdDia2);
  if (!conjunto) return { error: "CONJUNTO_NOT_FOUND" as const };

  const meta: ConjuntoPlanMeta = {
    conjuntoExamId,
    examIds: [examIdDia1, examIdDia2],
    provaIds: conjunto.provaIds,
  };

  const { gerarProvaIAConjunto } = await import("@/lib/prova-ia");
  const ia = await gerarProvaIAConjunto(userId, examIdDia1, examIdDia2, conjunto.nome);
  const prefixoQuest = `[${conjunto.nome.slice(0, 24)}]`;

  if (ia) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);

    await arquivarQuestsConjunto(userId, prefixoQuest);
    await prisma.studyPlan.deleteMany({
      where: { userId, provaId: conjunto.provaIds[0], escopo: "PROVA" },
    });

    const plan = await prisma.studyPlan.create({
      data: {
        userId,
        provaId: conjunto.provaIds[0],
        escopo: "PROVA",
        weekStart,
        itemsJson: JSON.stringify(ia.planoItems),
        narrativeJson: wrapNarrative(ia.narrativa, meta),
        fonteGeracao: "ia",
        recoveryMode: ia.recoveryMode,
      },
    });

    if (ia.quests.length > 0) {
      await prisma.quest.createMany({
        data: ia.quests.map((q) => ({
          userId,
          titulo: `${prefixoQuest} ${q.titulo}`,
          descricao: q.descricao,
          duracaoMin: q.duracaoMin,
          rewardMsg: "Foco na prova completa (180 questões).",
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

  const diagnosis = await buildDiagnosisForConjunto(userId, examIdDia1, examIdDia2);
  if (!diagnosis) return { error: "SEM_REGISTROS" as const };

  const exams = await prisma.exam.findMany({
    where: { userId, id: { in: [examIdDia1, examIdDia2] } },
    include: {
      questionAttempts: { include: { provaQuestao: true } },
      prova: { select: { id: true, banca: true, dia: true, nome: true, tipo: true } },
    },
  });
  const attempts = attemptsPonderadosJornada(exams);

  const withIA = await aplicarPlanoCoachIA(diagnosis, attempts, {
    examLabel: `${conjunto.nome} (completa)`,
  });

  let items: StudyPlanItem[] =
    withIA.aiStudyPlanItems?.length
      ? withIA.aiStudyPlanItems
      : generateStudyPlan(withIA, { ehProvaOficial: true }).items;

  items = [
    {
      ordem: 0,
      titulo: `Micro-plano — ${conjunto.nome}`,
      descricao:
        "Foco na prova completa (dia 1 + dia 2, 180 questões). Complementa o plano global da semana.",
      duracaoMin: 0,
      bloco: "contexto",
      geraQuest: false,
    },
    ...items.map((it, i) => ({ ...it, ordem: i + 1 })),
  ];

  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);

  await arquivarQuestsConjunto(userId, prefixoQuest);
  await prisma.studyPlan.deleteMany({
    where: { userId, provaId: conjunto.provaIds[0], escopo: "PROVA" },
  });

  const plan = await prisma.studyPlan.create({
    data: {
      userId,
      provaId: conjunto.provaIds[0],
      escopo: "PROVA",
      weekStart,
      itemsJson: JSON.stringify(items),
      narrativeJson: wrapNarrative(
        {
          fonte: "template",
          missaoTitulo: `Recuperar pontos em ${conjunto.nome}`,
          missaoDescricao: diagnosis.mensagem,
          missaoImpacto: null,
          diagnosticoTitulo: "Diagnóstico da prova completa",
          diagnosticoParagrafo: diagnosis.mensagem,
          camadas: {
            oQueAcontece: diagnosis.mensagem,
            comoCognitivo: "",
            quandoAparece: "",
            naoSignifica: "",
            caminho: "",
          },
          linhaAnamnese: null,
          geradoEm: new Date().toISOString(),
        },
        meta
      ),
      fonteGeracao: "template",
      recoveryMode: withIA.recoveryMode,
    },
  });

  const questData = planToQuests(
    items.filter((i) => i.geraQuest !== false && i.duracaoMin > 0),
    userId
  ).map((q) => ({
    ...q,
    titulo: `${prefixoQuest} ${q.titulo}`,
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

export async function getLeituraCoachConjunto(userId: string, conjuntoExamId: string) {
  const ids = parseConjuntoExamId(conjuntoExamId);
  if (!ids) return null;

  const conjunto = await loadConjuntoExamView(userId, ids[0], ids[1]);
  if (!conjunto) return null;

  const diagnosis = await buildDiagnosisForConjunto(userId, ids[0], ids[1]);
  if (!diagnosis) return null;

  const total = conjunto.questionAttempts.length;
  const pct = total > 0 ? Math.round((conjunto.acertos / total) * 100) : null;

  return {
    tituloProva: conjunto.nome,
    mensagem: diagnosis.mensagem,
    focos: diagnosis.focos.map((f) => ({ label: f.label, prioridade: f.prioridade })),
    pctReferencia: pct,
  };
}
