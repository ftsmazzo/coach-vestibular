/**
 * Testes dos resets administrativos da Jornada.
 * Executar: node --import tsx --test src/lib/jornada-reset-admin.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Prisma } from "@/generated/prisma/client";
import {
  CONFIRM_RESET_ANAMNESE,
  CONFIRM_RESET_JORNADA,
  CONFIRM_RESET_PLANO_JORNADA,
  confirmacaoEsperadaParaReset,
  executarResetJornadaAdmin,
  listarQuestIdsMotorJornada,
  resetarJornadaCompletaPreservandoDadosAdmin,
  resetarSomenteAnamneseAdmin,
  resetarSomentePlanoJornadaAdmin,
  validarConfirmacaoReset,
} from "./jornada-reset-admin";
import { ESCOPO_JORNADA_SEMANAL, FONTE_GERACAO_JORNADA_V1 } from "./jornada-plano-semanal";

type MockState = {
  studentAnamnesis: number;
  studyPlans: Array<{ id: string; escopo: string; fonteGeracao: string | null }>;
  quests: Array<{
    id: string;
    cicloId: string | null;
    fonteDiagnosticoJson: string | null;
  }>;
  journeySnapshots: number;
  learningCycles: Array<{ id: string }>;
  cicloQuizzes: number;
  exams: number;
  questionAttempts: number;
  diagnosticSnapshots: number;
  jornadaIniciadaEm: Date | null;
};

function fonteMotor(origem: "LearningCycle" | "JourneyDiagnosticSnapshot") {
  return JSON.stringify({
    versao: "1.0",
    cicloId: "ciclo-1",
    origem,
    snapshotId: "snap-1",
  });
}

function createMockDb(initial: MockState) {
  const state = structuredClone(initial);
  const deleted: Record<string, unknown[]> = {
    studentAnamnesis: [],
    studyPlan: [],
    quest: [],
    journeyDiagnosticSnapshot: [],
    learningCycle: [],
    cicloQuiz: [],
  };

  const tx = {
    studentAnamnesis: {
      deleteMany: async ({ where }: { where: { userId: string } }) => {
        deleted.studentAnamnesis.push(where);
        const n = state.studentAnamnesis;
        state.studentAnamnesis = 0;
        return { count: n };
      },
    },
    studyPlan: {
      deleteMany: async ({
        where,
      }: {
        where: {
          userId: string;
          escopo?: string;
          fonteGeracao?: string;
        };
      }) => {
        deleted.studyPlan.push(where);
        const antes = state.studyPlans.length;
        state.studyPlans = state.studyPlans.filter((p) => {
          if (p.escopo !== where.escopo) return true;
          if (where.fonteGeracao && p.fonteGeracao !== where.fonteGeracao) return true;
          return false;
        });
        return { count: antes - state.studyPlans.length };
      },
    },
    quest: {
      findMany: async ({
        where,
        select,
      }: {
        where: {
          userId?: string;
          cicloId?: { not: null } | { in: string[] };
        };
        select: { id?: boolean; cicloId?: boolean; fonteDiagnosticoJson?: boolean };
      }) => {
        let rows = state.quests;
        if (where.cicloId && "not" in where.cicloId) {
          rows = rows.filter((q) => q.cicloId != null);
        }
        if (where.cicloId && "in" in where.cicloId) {
          rows = rows.filter((q) => q.cicloId && where.cicloId.in.includes(q.cicloId));
        }
        return rows.map((q) => {
          const out: Record<string, unknown> = {};
          if (select.id) out.id = q.id;
          if (select.cicloId) out.cicloId = q.cicloId;
          if (select.fonteDiagnosticoJson) out.fonteDiagnosticoJson = q.fonteDiagnosticoJson;
          return out;
        });
      },
      deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
        deleted.quest.push(where);
        const antes = state.quests.length;
        state.quests = state.quests.filter((q) => !where.id.in.includes(q.id));
        return { count: antes - state.quests.length };
      },
    },
    journeyDiagnosticSnapshot: {
      deleteMany: async ({ where }: { where: { userId: string } }) => {
        deleted.journeyDiagnosticSnapshot.push(where);
        const n = state.journeySnapshots;
        state.journeySnapshots = 0;
        return { count: n };
      },
    },
    learningCycle: {
      findMany: async () => state.learningCycles.map((c) => ({ id: c.id })),
      deleteMany: async () => {
        deleted.learningCycle.push({ userId: "mock" });
        const n = state.learningCycles.length;
        state.learningCycles = [];
        return { count: n };
      },
    },
    cicloQuiz: {
      deleteMany: async ({ where }: { where: { cicloId: { in: string[] } } }) => {
        deleted.cicloQuiz.push(where);
        const n = state.cicloQuizzes;
        state.cicloQuizzes = 0;
        return { count: n };
      },
    },
    user: {
      update: async ({ data }: { data: { jornadaIniciadaEm: null } }) => {
        state.jornadaIniciadaEm = data.jornadaIniciadaEm;
        return {};
      },
    },
  } as unknown as Prisma.TransactionClient;

  const db = {
    $transaction: async <T>(fn: (t: Prisma.TransactionClient) => Promise<T>) => fn(tx),
    tx,
  };

  return { db, tx, state, deleted };
}

const USER = "user-test-1";

const estadoCompleto = (): MockState => ({
  studentAnamnesis: 1,
  studyPlans: [
    { id: "sp-jornada", escopo: ESCOPO_JORNADA_SEMANAL, fonteGeracao: FONTE_GERACAO_JORNADA_V1 },
    { id: "sp-prova", escopo: "PROVA", fonteGeracao: "motor-prova" },
    { id: "sp-global", escopo: "GLOBAL", fonteGeracao: "copiloto" },
  ],
  quests: [
    {
      id: "q-motor",
      cicloId: "ciclo-1",
      fonteDiagnosticoJson: fonteMotor("LearningCycle"),
    },
    {
      id: "q-ciclo-sem-fonte",
      cicloId: "ciclo-1",
      fonteDiagnosticoJson: null,
    },
    { id: "q-global", cicloId: null, fonteDiagnosticoJson: null },
  ],
  journeySnapshots: 1,
  learningCycles: [{ id: "ciclo-1" }],
  cicloQuizzes: 1,
  exams: 2,
  questionAttempts: 40,
  diagnosticSnapshots: 2,
  jornadaIniciadaEm: new Date("2026-06-01"),
});

describe("validação de confirmação", () => {
  it("confirmação errada não é aceita", () => {
    assert.equal(validarConfirmacaoReset("ANAMNESE", "ERRADO"), false);
    assert.equal(validarConfirmacaoReset("PLANO_JORNADA", CONFIRM_RESET_ANAMNESE), false);
    assert.equal(validarConfirmacaoReset("JORNADA", ""), false);
  });

  it("confirmações literais corretas", () => {
    assert.equal(confirmacaoEsperadaParaReset("ANAMNESE"), CONFIRM_RESET_ANAMNESE);
    assert.equal(confirmacaoEsperadaParaReset("PLANO_JORNADA"), CONFIRM_RESET_PLANO_JORNADA);
    assert.equal(confirmacaoEsperadaParaReset("JORNADA"), CONFIRM_RESET_JORNADA);
    assert.equal(validarConfirmacaoReset("JORNADA", CONFIRM_RESET_JORNADA), true);
  });

  it("executarResetJornadaAdmin bloqueia confirmação inválida", async () => {
    const r = await executarResetJornadaAdmin(USER, "PLANO_JORNADA", "RESET_ERRADO");
    assert.equal(r.ok, false);
    if (!r.ok) assert.match(r.error, /Confirmação inválida/);
  });
});

describe("resetarSomenteAnamneseAdmin", () => {
  it("apaga somente StudentAnamnesis", async () => {
    const { db, state, deleted } = createMockDb(estadoCompleto());
    const r = await resetarSomenteAnamneseAdmin(USER, db);

    assert.equal(r.studentAnamnesis, 1);
    assert.equal(state.studentAnamnesis, 0);
    assert.equal(state.journeySnapshots, 1);
    assert.equal(state.learningCycles.length, 1);
    assert.equal(state.studyPlans.length, 3);
    assert.equal(state.quests.length, 3);
    assert.equal(deleted.journeyDiagnosticSnapshot.length, 0);
    assert.equal(deleted.learningCycle.length, 0);
  });
});

describe("resetarSomentePlanoJornadaAdmin", () => {
  it("não apaga StudentAnamnesis", async () => {
    const { db, state } = createMockDb(estadoCompleto());
    await resetarSomentePlanoJornadaAdmin(USER, db);
    assert.equal(state.studentAnamnesis, 1);
  });

  it("não apaga JourneyDiagnosticSnapshot nem LearningCycle", async () => {
    const { db, state, deleted } = createMockDb(estadoCompleto());
    await resetarSomentePlanoJornadaAdmin(USER, db);
    assert.equal(state.journeySnapshots, 1);
    assert.equal(state.learningCycles.length, 1);
    assert.equal(deleted.journeyDiagnosticSnapshot.length, 0);
    assert.equal(deleted.learningCycle.length, 0);
  });

  it("apaga StudyPlan JORNADA_SEMANAL motor e quests do motor", async () => {
    const { db, state } = createMockDb(estadoCompleto());
    const r = await resetarSomentePlanoJornadaAdmin(USER, db);

    assert.equal(r.studyPlanJornada, 1);
    assert.equal(r.questsJornada, 1);
    assert.equal(
      state.studyPlans.some((p) => p.escopo === ESCOPO_JORNADA_SEMANAL),
      false
    );
    assert.equal(state.studyPlans.some((p) => p.escopo === "PROVA"), true);
    assert.equal(state.quests.some((q) => q.id === "q-motor"), false);
    assert.equal(state.quests.some((q) => q.id === "q-global"), true);
  });

  it("reset de plano nunca apaga anamnese", async () => {
    const { db, state } = createMockDb({ ...estadoCompleto(), studentAnamnesis: 1 });
    await resetarSomentePlanoJornadaAdmin(USER, db);
    assert.equal(state.studentAnamnesis, 1);
  });
});

describe("resetarJornadaCompletaPreservandoDadosAdmin", () => {
  it("não apaga StudentAnamnesis", async () => {
    const { db, state } = createMockDb(estadoCompleto());
    await resetarJornadaCompletaPreservandoDadosAdmin(USER, db);
    assert.equal(state.studentAnamnesis, 1);
  });

  it("não altera contadores de prova simulados (Exam, Attempt, DiagnosticSnapshot)", async () => {
    const base = estadoCompleto();
    const { db, state } = createMockDb(base);
    await resetarJornadaCompletaPreservandoDadosAdmin(USER, db);
    assert.equal(state.exams, base.exams);
    assert.equal(state.questionAttempts, base.questionAttempts);
    assert.equal(state.diagnosticSnapshots, base.diagnosticSnapshots);
  });

  it("apaga JourneyDiagnosticSnapshot, LearningCycle, plano jornada e quests", async () => {
    const { db, state } = createMockDb(estadoCompleto());
    const r = await resetarJornadaCompletaPreservandoDadosAdmin(USER, db);

    assert.equal(r.journeyDiagnosticSnapshots, 1);
    assert.equal(r.learningCycles, 1);
    assert.equal(r.studyPlanJornada, 1);
    assert.equal(r.questsJornada, 2);
    assert.equal(r.cicloQuizzes, 1);
    assert.equal(state.journeySnapshots, 0);
    assert.equal(state.learningCycles.length, 0);
    assert.equal(state.quests.filter((q) => q.cicloId).length, 0);
    assert.equal(state.quests.some((q) => q.id === "q-global"), true);
  });

  it("seta jornadaIniciadaEm = null", async () => {
    const { db, state } = createMockDb(estadoCompleto());
    const r = await resetarJornadaCompletaPreservandoDadosAdmin(USER, db);
    assert.equal(r.jornadaIniciadaEmResetada, true);
    assert.equal(state.jornadaIniciadaEm, null);
  });
});

describe("listarQuestIdsMotorJornada", () => {
  it("identifica quests do motor pela fonte e cicloId", async () => {
    const { tx } = createMockDb(estadoCompleto());
    const ids = await listarQuestIdsMotorJornada(tx, USER);
    assert.deepEqual(ids, ["q-motor"]);
  });
});
