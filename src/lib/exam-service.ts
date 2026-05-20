import type { ErrorType } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { buildDiagnosis } from "./diagnosis";
import { generateStudyPlan, planToQuests } from "./study-plan";

export interface QuestionInput {
  numero: number;
  correto: boolean;
  materiaId?: string;
  temaId?: string;
  tipoErro?: ErrorType;
  observacao?: string;
}

export interface CreateExamInput {
  userId: string;
  nome: string;
  data: string;
  banca?: string;
  totalQuestoes: number;
  nota?: number;
  checkInScore?: number;
  questoes: QuestionInput[];
}

export async function createExamWithDiagnosis(input: CreateExamInput) {
  const historicalExams = await prisma.exam.findMany({
    where: { userId: input.userId },
    orderBy: { data: "desc" },
    take: 5,
    include: { questionAttempts: true },
  });

  const diagnosis = buildDiagnosis(
    input.questoes,
    historicalExams.map((e) => e.questionAttempts),
    { checkInScore: input.checkInScore, examLabel: input.nome }
  );

  const exam = await prisma.exam.create({
    data: {
      userId: input.userId,
      nome: input.nome,
      data: new Date(input.data),
      banca: input.banca ?? "ENEM",
      totalQuestoes: input.totalQuestoes,
      nota: input.nota,
      checkInScore: input.checkInScore,
      recoveryMode: diagnosis.recoveryMode,
      questionAttempts: {
        create: input.questoes.map((q) => ({
          numero: q.numero,
          correto: q.correto,
          materiaId: q.materiaId,
          temaId: q.temaId,
          tipoErro: q.tipoErro,
          observacao: q.observacao,
        })),
      },
      diagnosticSnapshot: {
        create: {
          userId: input.userId,
          scoresJson: JSON.stringify({
            overallAcerto: diagnosis.overallAcerto,
            materiaScores: diagnosis.materiaScores,
            temaScores: diagnosis.temaScores,
            tipoErroCounts: diagnosis.tipoErroCounts,
          }),
          focosJson: JSON.stringify(diagnosis.focos),
          mensagem: diagnosis.mensagem,
          recoveryMode: diagnosis.recoveryMode,
        },
      },
      ...(input.checkInScore
        ? {
            emotionalLog: {
              create: {
                userId: input.userId,
                score: input.checkInScore,
              },
            },
          }
        : {}),
    },
    include: {
      questionAttempts: true,
      diagnosticSnapshot: true,
    },
  });

  const { items, recoveryMode } = generateStudyPlan(diagnosis);
  const weekStart = getWeekStart(new Date());

  await prisma.studyPlan.create({
    data: {
      userId: input.userId,
      weekStart,
      itemsJson: JSON.stringify(items),
      recoveryMode,
    },
  });

  const questData = planToQuests(items, input.userId);
  if (questData.length > 0) {
    await prisma.quest.createMany({ data: questData });
  }

  return { exam, diagnosis };
}

function getWeekStart(date: Date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function getDashboardData(userId: string) {
  const exams = await prisma.exam.findMany({
    where: { userId },
    orderBy: { data: "desc" },
    include: {
      questionAttempts: true,
      diagnosticSnapshot: true,
    },
  });

  const latest = exams[0];
  const studyPlan = await prisma.studyPlan.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const quests = await prisma.quest.findMany({
    where: { userId, status: "pending" },
    orderBy: { createdAt: "desc" },
    take: 10,
  });

  const evolution = exams
    .slice()
    .reverse()
    .map((e) => {
      const total = e.questionAttempts.length;
      const acertos = e.questionAttempts.filter((q) => q.correto).length;
      return {
        nome: e.nome,
        data: e.data.toISOString().slice(0, 10),
        taxaAcerto: total > 0 ? Math.round((acertos / total) * 100) : 0,
      };
    });

  const materiaEvolution: Record<string, number[]> = {};
  for (const exam of exams.slice(0, 5).reverse()) {
    for (const q of exam.questionAttempts) {
      if (!q.materiaId) continue;
      if (!materiaEvolution[q.materiaId]) materiaEvolution[q.materiaId] = [];
      materiaEvolution[q.materiaId].push(q.correto ? 1 : 0);
    }
  }

  let streak = 0;
  const sortedDates = [...new Set(exams.map((e) => e.data.toDateString()))];
  const today = new Date();
  for (let i = 0; i < sortedDates.length; i++) {
    const expected = new Date(today);
    expected.setDate(expected.getDate() - i);
    if (sortedDates.includes(expected.toDateString())) streak++;
    else if (i > 0) break;
  }

  return {
    exams,
    latest,
    studyPlan,
    quests,
    evolution,
    materiaEvolution,
    streak,
  };
}
