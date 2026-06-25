import type { ErrorType, ModoUsoRegistro, ProvaTipo } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { formatDataAplicacao, parseDataAplicacao } from "./data-prova";
import { pctAcertoRegistro } from "./exam-stats";
import { getQuestsDoPlanoAtual } from "./plano-atual";
import {
  categoriaDoRegistro,
  registroPassaFiltro,
  type FiltroRegistros,
} from "./prova-tipo";
import { mapQuestionAttemptToInput } from "./question-attempt-input";
import { calcularStreakRegistros } from "./streak";

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
  modoUso?: ModoUsoRegistro;
  provaTipoDiagnostico?: ProvaTipo;
}

/**
 * Registro histórico de simulado manual — fora do motor v1.
 * Para plano/copiloto por escopo, use provas do catálogo admin.
 */
export async function createExamWithDiagnosis(input: CreateExamInput) {
  const acertos = input.questoes.filter((q) => q.correto).length;
  const total = input.questoes.length;
  const overallAcerto = total > 0 ? acertos / total : 0;
  const recoveryMode =
    overallAcerto < 0.45 ||
    (input.checkInScore !== undefined && input.checkInScore !== null && input.checkInScore <= 2);

  const modoUso = input.modoUso ?? "OFICIAL";

  const exam = await prisma.exam.create({
    data: {
      userId: input.userId,
      nome: input.nome,
      data: parseDataAplicacao(input.data),
      banca: input.banca ?? "ENEM",
      totalQuestoes: input.totalQuestoes,
      nota: input.nota,
      checkInScore: input.checkInScore,
      recoveryMode,
      modoUso,
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
            overallAcerto,
            manual: true,
            tipoErroCounts: {},
            mensagem:
              "Registro manual — para copiloto por escopo, use provas do catálogo classificadas (N2) no admin.",
          }),
          focosJson: JSON.stringify([]),
          mensagem:
            "Simulado manual registrado. O plano por escopo N2 usa provas do catálogo.",
          recoveryMode,
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

  return {
    exam,
    diagnosis: {
      overallAcerto,
      recoveryMode,
      manual: true as const,
    },
  };
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

  const streakInfo = calcularStreakRegistros(exams.map((e) => e.createdAt));

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
    streak: streakInfo.streak,
    streakInfo,
  };
}
