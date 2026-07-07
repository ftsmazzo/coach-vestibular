/**
 * Resets administrativos da Jornada — ações isoladas e seguras.
 * Nunca misturar anamnese, plano semanal, diagnóstico ou jornada completa.
 */
import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  ESCOPO_JORNADA_SEMANAL,
  FONTE_GERACAO_JORNADA_V1,
  isQuestJornadaMotor,
} from "@/lib/jornada-plano-semanal";

export const CONFIRM_RESET_ANAMNESE = "RESET_ANAMNESE" as const;
export const CONFIRM_RESET_PLANO_JORNADA = "RESET_PLANO_JORNADA" as const;
export const CONFIRM_RESET_JORNADA = "RESET_JORNADA" as const;

export type JornadaResetTipo = "ANAMNESE" | "PLANO_JORNADA" | "JORNADA";

export type JornadaResetContagens = {
  studentAnamnesis: number;
  studyPlanJornada: number;
  questsJornada: number;
  journeyDiagnosticSnapshots: number;
  learningCycles: number;
  cicloQuizzes: number;
  jornadaIniciadaEmResetada: boolean;
};

export const JORNADA_RESET_CONTAGENS_VAZIAS: JornadaResetContagens = {
  studentAnamnesis: 0,
  studyPlanJornada: 0,
  questsJornada: 0,
  journeyDiagnosticSnapshots: 0,
  learningCycles: 0,
  cicloQuizzes: 0,
  jornadaIniciadaEmResetada: false,
};

type DbClient = Prisma.TransactionClient | typeof prisma;

const CONFIRMACOES: Record<JornadaResetTipo, string> = {
  ANAMNESE: CONFIRM_RESET_ANAMNESE,
  PLANO_JORNADA: CONFIRM_RESET_PLANO_JORNADA,
  JORNADA: CONFIRM_RESET_JORNADA,
};

export function confirmacaoEsperadaParaReset(tipo: JornadaResetTipo): string {
  return CONFIRMACOES[tipo];
}

export function validarConfirmacaoReset(tipo: JornadaResetTipo, confirmar: string): boolean {
  return confirmar === CONFIRMACOES[tipo];
}

export async function listarQuestIdsMotorJornada(
  tx: Prisma.TransactionClient,
  userId: string
): Promise<string[]> {
  const quests = await tx.quest.findMany({
    where: { userId, cicloId: { not: null } },
    select: { id: true, cicloId: true, fonteDiagnosticoJson: true },
  });
  return quests.filter(isQuestJornadaMotor).map((q) => q.id);
}

/** Apaga somente StudentAnamnesis do usuário. */
export async function resetarSomenteAnamneseAdmin(
  userId: string,
  db: DbClient = prisma
): Promise<JornadaResetContagens> {
  const executar = async (tx: Prisma.TransactionClient) => {
    const r = await tx.studentAnamnesis.deleteMany({ where: { userId } });
    return { ...JORNADA_RESET_CONTAGENS_VAZIAS, studentAnamnesis: r.count };
  };

  if ("$transaction" in db) {
    return db.$transaction(executar);
  }
  return executar(db);
}

/**
 * Apaga plano semanal da Jornada e quests do motor-jornada-v1.
 * Preserva: anamnese, JourneyDiagnosticSnapshot INICIAL, LearningCycle, provas.
 */
export async function resetarSomentePlanoJornadaAdmin(
  userId: string,
  db: DbClient = prisma
): Promise<JornadaResetContagens> {
  const executar = async (tx: Prisma.TransactionClient) => {
    const questIds = await listarQuestIdsMotorJornada(tx, userId);

    const [quests, planos] = await Promise.all([
      questIds.length > 0
        ? tx.quest.deleteMany({ where: { id: { in: questIds } } })
        : Promise.resolve({ count: 0 }),
      tx.studyPlan.deleteMany({
        where: {
          userId,
          escopo: ESCOPO_JORNADA_SEMANAL,
          fonteGeracao: FONTE_GERACAO_JORNADA_V1,
        },
      }),
    ]);

    return {
      ...JORNADA_RESET_CONTAGENS_VAZIAS,
      questsJornada: quests.count,
      studyPlanJornada: planos.count,
    };
  };

  if ("$transaction" in db) {
    return db.$transaction(executar);
  }
  return executar(db);
}

/**
 * Zera a Jornada longitudinal para recriar diagnóstico, ciclo, plano e quests.
 * Preserva: anamnese, provas, QuestionAttempt, DiagnosticSnapshot por prova, classificações.
 */
export async function resetarJornadaCompletaPreservandoDadosAdmin(
  userId: string,
  db: DbClient = prisma
): Promise<JornadaResetContagens> {
  const executar = async (tx: Prisma.TransactionClient) => {
    const ciclos = await tx.learningCycle.findMany({
      where: { userId },
      select: { id: true },
    });
    const cicloIds = ciclos.map((c) => c.id);

    const questIdsMotor = await listarQuestIdsMotorJornada(tx, userId);
    const questsPorCiclo =
      cicloIds.length > 0
        ? await tx.quest.findMany({
            where: { cicloId: { in: cicloIds } },
            select: { id: true },
          })
        : [];
    const allQuestIds = [...new Set([...questIdsMotor, ...questsPorCiclo.map((q) => q.id)])];

    const [cicloQuizzes, quests, planos, snapshots, ciclosRemovidos] = await Promise.all([
      cicloIds.length > 0
        ? tx.cicloQuiz.deleteMany({ where: { cicloId: { in: cicloIds } } })
        : Promise.resolve({ count: 0 }),
      allQuestIds.length > 0
        ? tx.quest.deleteMany({ where: { id: { in: allQuestIds } } })
        : Promise.resolve({ count: 0 }),
      tx.studyPlan.deleteMany({
        where: { userId, escopo: ESCOPO_JORNADA_SEMANAL },
      }),
      tx.journeyDiagnosticSnapshot.deleteMany({ where: { userId } }),
      tx.learningCycle.deleteMany({ where: { userId } }),
    ]);

    await tx.user.update({
      where: { id: userId },
      data: { jornadaIniciadaEm: null },
    });

    return {
      ...JORNADA_RESET_CONTAGENS_VAZIAS,
      cicloQuizzes: cicloQuizzes.count,
      questsJornada: quests.count,
      studyPlanJornada: planos.count,
      journeyDiagnosticSnapshots: snapshots.count,
      learningCycles: ciclosRemovidos.count,
      jornadaIniciadaEmResetada: true,
    };
  };

  if ("$transaction" in db) {
    return db.$transaction(executar);
  }
  return executar(db);
}

export async function executarResetJornadaAdmin(
  userId: string,
  tipo: JornadaResetTipo,
  confirmar: string
): Promise<{ ok: true; contagens: JornadaResetContagens } | { ok: false; error: string }> {
  if (!validarConfirmacaoReset(tipo, confirmar)) {
    return {
      ok: false,
      error: `Confirmação inválida. Esperado: ${confirmacaoEsperadaParaReset(tipo)}`,
    };
  }

  let contagens: JornadaResetContagens;
  switch (tipo) {
    case "ANAMNESE":
      contagens = await resetarSomenteAnamneseAdmin(userId);
      break;
    case "PLANO_JORNADA":
      contagens = await resetarSomentePlanoJornadaAdmin(userId);
      break;
    case "JORNADA":
      contagens = await resetarJornadaCompletaPreservandoDadosAdmin(userId);
      break;
  }

  return { ok: true, contagens };
}
