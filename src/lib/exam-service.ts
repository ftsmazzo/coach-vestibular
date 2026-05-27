import type { ErrorType } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { formatDataAplicacao, parseDataAplicacao } from "./data-prova";
import { pctAcertoRegistro } from "./exam-stats";
import { getQuestsDoPlanoAtual } from "./plano-atual";
import {
  categoriaDoRegistro,
  registroPassaFiltro,
  type FiltroRegistros,
} from "./prova-tipo";
import { aplicarPlanoCoachIA, buildDiagnosis } from "./diagnosis";
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

  const nameUpper = input.nome.toUpperCase();
  const inferredProvaTipo = nameUpper.includes("ENEM") || nameUpper.includes("VESTIBULAR")
    ? "ENEM_OFICIAL"
    : "SIMULADO";

  let diagnosis = await buildDiagnosis(
    input.questoes,
    historicalExams.map((e) => e.questionAttempts),
    { checkInScore: input.checkInScore, examLabel: input.nome, provaTipo: inferredProvaTipo }
  );

  diagnosis = await aplicarPlanoCoachIA(diagnosis, input.questoes, {
    checkInScore: input.checkInScore,
    examLabel: input.nome,
  });

  const exam = await prisma.exam.create({
    data: {
      userId: input.userId,
      nome: input.nome,
      data: parseDataAplicacao(input.data),
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

  const items = diagnosis.aiStudyPlanItems || generateStudyPlan(diagnosis).items;
  const recoveryMode = diagnosis.recoveryMode;
  const weekStart = getWeekStart(new Date());

  await prisma.studyPlan.create({
    data: {
      userId: input.userId,
      weekStart,
      itemsJson: JSON.stringify(items),
      recoveryMode,
    },
  });

  await prisma.quest.updateMany({
    where: { userId: input.userId, status: "pending" },
    data: { status: "skipped" },
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

export async function getDashboardData(userId: string, filtro: FiltroRegistros = "todos") {
  const exams = await prisma.exam.findMany({
    where: { userId },
    orderBy: { data: "desc" },
    include: {
      questionAttempts: true,
      diagnosticSnapshot: true,
      prova: { select: { tipo: true, nome: true } },
    },
  });

  const counts = {
    todos: exams.length,
    provas: exams.filter((e) => registroPassaFiltro(e, "provas")).length,
    simulados: exams.filter((e) => registroPassaFiltro(e, "simulados")).length,
  };

  const examsFiltrados = exams.filter((e) => registroPassaFiltro(e, filtro));
  const latest = examsFiltrados[0];
  const latestProva = exams.find((e) => registroPassaFiltro(e, "provas"));
  const latestSimulado = exams.find((e) => registroPassaFiltro(e, "simulados"));
  const studyPlan = await prisma.studyPlan.findFirst({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  const { quests: questsPlano } = await getQuestsDoPlanoAtual(userId);
  const quests = questsPlano.filter((q) => q.status === "pending").slice(0, 10);

  const evolution = examsFiltrados
    .slice()
    .reverse()
    .map((e) => ({
      nome: e.nome,
      data: formatDataAplicacao(e.data),
      taxaAcerto: pctAcertoRegistro(e.questionAttempts),
      categoria: categoriaDoRegistro(e),
    }));

  const materiaEvolution: Record<string, number[]> = {};
  for (const exam of examsFiltrados.slice(0, 5).reverse()) {
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
    examsFiltrados,
    counts,
    filtro,
    latest,
    latestProva,
    latestSimulado,
    studyPlan,
    quests,
    evolution,
    materiaEvolution,
    streak,
  };
}
