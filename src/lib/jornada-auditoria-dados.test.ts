/**
 * Etapa 4E-A — testes de comparação da auditoria.
 * Executar: node --import tsx --test src/lib/jornada-auditoria-dados.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  compararCicloComCanonica,
  compararDiagnosticoComCanonica,
  compararGraficoProvaComCanonica,
} from "./jornada-auditoria-comparacao";
import type { EscopoAgregadoCanonica } from "./jornada-evidencia-canonica";

const ESCOPO = "mat.geometria.soma_angulos";

const agregado: EscopoAgregadoCanonica[] = [
  {
    escopoId: ESCOPO,
    label: "Soma de ângulos em figuras planas",
    total: 3,
    acertos: 0,
    erros: 3,
    pctErro: 100,
    provasComQuestao: 2,
    provasComErro: 2,
    ocorrenciasPorProva: [
      { examId: "a", nome: "FAMERP", total: 2, erros: 2, numerosErradas: [12, 28] },
      { examId: "b", nome: "UNESP", total: 1, erros: 1, numerosErradas: [15] },
    ],
    n3Recorrentes: [],
    tiposErroDominantes: [{ tipo: "CONCEITO_TEORICO", count: 3 }],
  },
];

describe("compararDiagnosticoComCanonica", () => {
  it("detecta divergência de erros no baseline", () => {
    const div = compararDiagnosticoComCanonica(agregado, [
      { escopoId: ESCOPO, total: 3, erros: 2, provasComErro: 2 },
    ]);
    assert.equal(div.length, 1);
    assert.equal(div[0]!.campo, "erros");
    assert.equal(div[0]!.canonico, 3);
    assert.equal(div[0]!.encontrado, 2);
  });

  it("sem divergência quando baseline bate", () => {
    const div = compararDiagnosticoComCanonica(agregado, [
      { escopoId: ESCOPO, total: 3, erros: 3, provasComErro: 2 },
    ]);
    assert.equal(div.length, 0);
  });
});

describe("compararCicloComCanonica", () => {
  it("detecta divergência no ciclo Semana 1", () => {
    const div = compararCicloComCanonica(agregado, ESCOPO, 2, 3);
    assert.equal(div.some((d) => d.campo === "errosNoEscopo"), true);
  });
});

describe("compararGraficoProvaComCanonica", () => {
  it("detecta divergência quando gráfico não lista escopo canônico", () => {
    const div = compararGraficoProvaComCanonica(
      "FAMERP",
      [
        {
          escopoId: ESCOPO,
          label: "Soma de ângulos",
          total: 2,
          erros: 2,
        },
      ],
      []
    );
    assert.equal(div.length, 1);
    assert.equal(div[0]!.campo, "escopoAusente");
  });
});
