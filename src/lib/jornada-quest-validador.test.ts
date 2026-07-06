/**
 * Testes do validador de quests — Etapa 4B.
 * Executar: node --import tsx --test src/lib/jornada-quest-validador.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  validarQuestJornada,
  type QuestJornadaDraft,
  type FonteDiagnosticoQuestJornada,
} from "./jornada-quest-validador";
import { templateTreinoGuiado } from "./jornada-quest-templates";
import type { BaselineCicloInicial } from "./jornada-ciclo-inicial";

const baselineMinimo: BaselineCicloInicial = {
  versao: "1.0",
  origem: "JourneyDiagnosticSnapshot:INICIAL",
  snapshotInicialId: "snap-1",
  criadoEm: "2026-06-01T12:00:00.000Z",
  foco: {
    escopoId: "quim.gases.ideal",
    titulo: "Gases ideais",
    motivo: "Alto índice de erro recorrente.",
  },
  evidencias: {
    totalQuestoesNoEscopo: 8,
    acertosNoEscopo: 2,
    errosNoEscopo: 6,
    pctErro: 75,
    provasComErro: 2,
    conhecimentosExigidos: ["PV=nRT"],
    tiposErro: { CONCEITO_TEORICO: 4 },
    observacoesAluno: [],
  },
  leitura: {
    problemaPrincipal: "Lacuna conceitual",
    hipoteseDiagnostica: "Confusão entre grandezas",
    oQueSeraObservadoNaSemana: "Respostas no escopo",
    oQueNaoPodeSerConcluidoAinda: "Domínio global",
  },
};

function draftBase(overrides: Partial<QuestJornadaDraft> = {}): QuestJornadaDraft {
  const ctx = {
    cicloId: "ciclo-1",
    snapshotId: "snap-1",
    escopoId: "quim.gases.ideal",
    dominioId: "quim.fisico",
    escopoLabel: "Gases ideais",
    motivoFoco: "Alto índice de erro",
    baseline: baselineMinimo,
    tiposErro: { CONCEITO_TEORICO: 4 },
    conhecimentosExigidos: ["PV=nRT"],
  };
  const template = templateTreinoGuiado(ctx);
  return { ...template, ...overrides };
}

describe("validador rejeita quests genéricas", () => {
  it("11. rejeita Estudar gases", () => {
    const q = draftBase({
      titulo: "Estudar gases",
      descricao:
        "Estudar gases do vestibular com foco na matéria. ".repeat(3) +
        "\n\nConcluir quando: nunca.",
    });
    const r = validarQuestJornada(q, { escopoId: "quim.gases.ideal", titulo: "Gases ideais" });
    assert.equal(r.valida, false);
    assert.ok(r.motivos.some((m) => m.includes("estudar mais") || m.includes("sem verbo")));
  });

  it("12. rejeita Reforçar conhecimentos", () => {
    const q = draftBase({
      titulo: "Reforço química",
      descricao:
        "Reforçar conhecimentos de química nesta semana para melhorar. ".repeat(2) +
        "\n\nConcluir quando: terminar.",
      criterioConclusao: "Terminar",
    });
    const r = validarQuestJornada(q, { escopoId: "quim.gases.ideal", titulo: "Gases ideais" });
    assert.equal(r.valida, false);
    assert.ok(r.motivos.some((m) => m.includes("reforçar") || m.includes("linguagem vaga")));
  });

  it("13. rejeita descrição sem verbo de ação", () => {
    const q = draftBase({
      titulo: "Quest sem verbo",
      descricao:
        "Gases ideais são importantes no vestibular e aparecem com frequência nas provas oficiais de química. ".repeat(
          2
        ),
    });
    const r = validarQuestJornada(q, { escopoId: "quim.gases.ideal", titulo: "Gases ideais" });
    assert.equal(r.valida, false);
    assert.ok(r.motivos.includes("sem verbo de acao observavel"));
  });

  it("14. rejeita promessa de domínio global", () => {
    const q = draftBase({
      descricao:
        "Resolva questões até garantir evolução global no escopo e domínio consolidado na prova. ".repeat(
          2
        ) + "\n\nConcluir quando: dominar.",
    });
    const r = validarQuestJornada(q, { escopoId: "quim.gases.ideal", titulo: "Gases ideais" });
    assert.equal(r.valida, false);
    assert.ok(r.motivos.some((m) => m.includes("dominio") || m.includes("evolucao")));
  });

  it("aceita template determinístico válido", () => {
    const q = draftBase();
    const r = validarQuestJornada(q, { escopoId: "quim.gases.ideal", titulo: "Gases ideais" });
    assert.equal(r.valida, true);
  });
});
