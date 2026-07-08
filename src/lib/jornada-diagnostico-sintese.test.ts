/**
 * Etapa 4D — testes da síntese narrativa do Diagnóstico Inicial.
 * Executar: node --import tsx --test src/lib/jornada-diagnostico-sintese.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { BaselineEscopoJornada } from "./jornada-diagnostico-inicial";
import {
  escopoElegivelParaDiagnosticoCritico,
  montarEvidenciasEscopoRicas,
  montarResumoExecutivoDiagnostico,
  motivoDiagnosticoEscopo,
} from "./jornada-diagnostico-sintese";
import { avaliarQualidadeFocoInicial, inputEscopoFromBaseline } from "./jornada-foco-inicial";

function linhaEscopo(overrides: Partial<BaselineEscopoJornada> = {}): BaselineEscopoJornada {
  return {
    escopoId: "quim.gases.ideal",
    dominioId: "quim.fisico",
    total: 8,
    acertos: 2,
    erros: 6,
    pctErro: 75,
    conhecimentosExigidos: [
      "Aplicar PV=nRT em condições ideais",
      "Relacionar pressão e volume em transformações isotérmicas",
    ],
    conceitosCanonicos: ["gases ideais"],
    tiposErro: { CONCEITO_TEORICO: 4, INTERPRETACAO_ENUNCIADO: 2 },
    observacoesAluno: ["Confundi unidade de pressão"],
    pesoDiagnostico: 18,
    estadoInicial: "CRITICO",
    provasComErro: 2,
    ...overrides,
  };
}

describe("escopoElegivelParaDiagnosticoCritico", () => {
  it("rejeita escopo com 1 erro isolado", () => {
    assert.equal(
      escopoElegivelParaDiagnosticoCritico(
        linhaEscopo({ erros: 1, estadoInicial: "SINAL_INICIAL", total: 3 })
      ),
      false
    );
  });

  it("aceita escopo com recorrência e volume", () => {
    assert.equal(escopoElegivelParaDiagnosticoCritico(linhaEscopo()), true);
  });
});

describe("montarEvidenciasEscopoRicas", () => {
  it("não usa apenas 'recorrência em N provas' como única evidência", () => {
    const ev = montarEvidenciasEscopoRicas(linhaEscopo(), "Gases ideais");
    assert.ok(ev.length >= 2);
    assert.ok(ev[0]!.includes("6 erros"));
    assert.ok(ev.some((e) => e.includes("lacuna conceitual") || e.includes("Padrão dominante")));
    assert.ok(ev.some((e) => e.includes("Conhecimento") || e.includes("Conhecimentos")));
    assert.equal(ev.some((e) => e === "Recorrência em 2 provas"), false);
  });
});

describe("motivoDiagnosticoEscopo", () => {
  it("inclui interpretação pedagógica além da contagem", () => {
    const linha = linhaEscopo();
    const qualidade = avaliarQualidadeFocoInicial(
      inputEscopoFromBaseline(linha, "Gases ideais")
    );
    const motivo = motivoDiagnosticoEscopo(linha, "Gases ideais", qualidade);
    assert.ok(motivo.includes("Gases ideais"));
    assert.ok(
      motivo.includes("lacuna") ||
        motivo.includes("conteúdo") ||
        motivo.includes("conhecimentos parecidos")
    );
    assert.equal(motivo.includes("Recorrência em 2 provas"), false);
  });
});

describe("montarResumoExecutivoDiagnostico", () => {
  it("nomeia prioridade e contexto, não conta genérica de escopos", () => {
    const resumo = montarResumoExecutivoDiagnostico({
      provas: 2,
      questoes: 170,
      pctAcerto: 58,
      escoposCriticos: [],
      prioridades: [
        {
          ordem: 1,
          titulo: "Gases ideais",
          motivo: "teste",
          tipoPrioridade: "CONTEUDO",
        },
      ],
      forcas: [{ titulo: "Geometria plana", descricao: "", evidencias: [], escoposAssociados: [] }],
      moduladoresAnamnese: ["Ansiedade em prova"],
      confirmacoesAnamnese: [],
    });
    assert.ok(resumo.includes("170 questões"));
    assert.ok(resumo.includes("Gases ideais"));
    assert.ok(resumo.includes("Geometria plana"));
    assert.equal(resumo.includes("escopo(s) que pedem atenção"), false);
  });
});
