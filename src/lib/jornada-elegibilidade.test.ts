/**
 * Testes da elegibilidade da Jornada — docs/MOTOR-JORNADA-DIAGNOSTICO.md §16.
 * Executar: node --import tsx --test src/lib/jornada-elegibilidade.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MIN_ERROS_ANALISAVEIS_JORNADA,
  MIN_PROVAS_JORNADA,
  MIN_QUESTOES_JORNADA,
  calcularElegibilidadeJornada,
  erroAnalisavel,
  questaoTemN1N2N3,
  type MetricasElegibilidadeJornada,
} from "./jornada-elegibilidade";

function metricasBase(
  overrides: Partial<MetricasElegibilidadeJornada> = {}
): MetricasElegibilidadeJornada {
  return {
    anamneseConcluida: true,
    provasOuSimuladosValidos: MIN_PROVAS_JORNADA,
    totalQuestoesValidas: MIN_QUESTOES_JORNADA,
    totalErrosAnalisaveis: MIN_ERROS_ANALISAVEIS_JORNADA,
    pctQuestoesComN1N2N3: 0.96,
    ...overrides,
  };
}

describe("calcularElegibilidadeJornada", () => {
  it("1. com 0 provas, Jornada bloqueada", () => {
    const r = calcularElegibilidadeJornada(
      metricasBase({ provasOuSimuladosValidos: 0, totalQuestoesValidas: 0, totalErrosAnalisaveis: 0 })
    );
    assert.equal(r.elegivel, false);
    assert.ok(r.motivosBloqueio.some((m) => m.includes("duas provas")));
  });

  it("2. com 1 prova, Jornada bloqueada", () => {
    const r = calcularElegibilidadeJornada(
      metricasBase({
        provasOuSimuladosValidos: 1,
        totalQuestoesValidas: 40,
        totalErrosAnalisaveis: 8,
      })
    );
    assert.equal(r.elegivel, false);
    assert.ok(r.motivosBloqueio.some((m) => m.includes("duas provas")));
  });

  it("3. com 2 provas mas anamnese incompleta, bloqueada", () => {
    const r = calcularElegibilidadeJornada(metricasBase({ anamneseConcluida: false }));
    assert.equal(r.elegivel, false);
    assert.ok(r.motivosBloqueio.some((m) => m.includes("anamnese")));
  });

  it("4. com 2 provas mas menos de 80 questões, bloqueada", () => {
    const r = calcularElegibilidadeJornada(
      metricasBase({ totalQuestoesValidas: MIN_QUESTOES_JORNADA - 1 })
    );
    assert.equal(r.elegivel, false);
    assert.ok(r.motivosBloqueio.some((m) => m.includes("poucas questões")));
  });

  it("5. com 2 provas mas poucos erros analisáveis, bloqueada", () => {
    const r = calcularElegibilidadeJornada(
      metricasBase({ totalErrosAnalisaveis: MIN_ERROS_ANALISAVEIS_JORNADA - 1 })
    );
    assert.equal(r.elegivel, false);
    assert.ok(r.motivosBloqueio.some((m) => m.includes("erros prontos para análise")));
  });

  it("6. com 2 provas e processamento pedagógico incompleto, bloqueada", () => {
    const r = calcularElegibilidadeJornada(metricasBase({ pctQuestoesComN1N2N3: 0.9 }));
    assert.equal(r.elegivel, false);
    assert.ok(r.motivosBloqueio.some((m) => m.includes("sendo preparadas pela equipe")));
  });

  it("7. com todos os critérios atendidos, liberada", () => {
    const r = calcularElegibilidadeJornada(metricasBase());
    assert.equal(r.elegivel, true);
    assert.equal(r.motivosBloqueio.length, 0);
  });
});

describe("classificação pedagógica", () => {
  it("questaoTemN1N2N3 exige escopo real e N3", () => {
    assert.equal(
      questaoTemN1N2N3({
        n1CatalogoId: "historia",
        escopoId: "hist.moderna.absolutismo",
        conhecimentoExigido: "Compreender o absolutismo.",
      }),
      true
    );
    assert.equal(
      questaoTemN1N2N3({
        n1CatalogoId: "historia",
        escopoId: "hist.__nao_classificado",
        conhecimentoExigido: "x",
      }),
      false
    );
  });

  it("erroAnalisavel só conta erro com N1/N2/N3", () => {
    assert.equal(
      erroAnalisavel({
        correto: false,
        n1CatalogoId: "quimica",
        escopoId: "quim.gases.ideal",
        conhecimentoExigido: "Aplicar PV=nRT.",
      }),
      true
    );
    assert.equal(
      erroAnalisavel({
        correto: true,
        n1CatalogoId: "quimica",
        escopoId: "quim.gases.ideal",
        conhecimentoExigido: "Aplicar PV=nRT.",
      }),
      false
    );
  });
});

describe("evidências fracas não liberam jornada por si só", () => {
  it("8. quest concluída isolada não altera critério de provas (plano bloqueado sem iniciar)", () => {
    // Quests não entram em provasOuSimuladosValidos — só exams OFICIAL/TREINO.
    const semProvas = calcularElegibilidadeJornada(
      metricasBase({
        provasOuSimuladosValidos: 0,
        totalQuestoesValidas: 5,
        totalErrosAnalisaveis: 0,
        pctQuestoesComN1N2N3: 1,
      })
    );
    assert.equal(semProvas.elegivel, false);
  });

  it("9. mini-quiz isolado não conta como prova válida", () => {
    const umaProva = calcularElegibilidadeJornada(
      metricasBase({
        provasOuSimuladosValidos: 1,
        totalQuestoesValidas: 90,
        totalErrosAnalisaveis: 20,
      })
    );
    assert.equal(umaProva.elegivel, false);
  });

  it("10. relatório de prova é independente da elegibilidade (métricas podem existir com bloqueio)", () => {
    const r = calcularElegibilidadeJornada(
      metricasBase({
        provasOuSimuladosValidos: 1,
        totalQuestoesValidas: 45,
        totalErrosAnalisaveis: 10,
        anamneseConcluida: true,
      })
    );
    assert.equal(r.elegivel, false);
    assert.ok(r.metricas.totalQuestoesValidas > 0);
  });
});
