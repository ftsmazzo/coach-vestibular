/**
 * Etapa 4C — testes de qualidade do foco inicial e templates de inglês.
 * Executar: node --import tsx --test src/lib/jornada-foco-inicial.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  avaliarQualidadeFocoInicial,
  isMicroescopoIngles,
  selecionarMelhorFocoSemana1,
  tentarElevarFocoIngles,
  SCORE_MINIMO_FOCO_SEMANA1,
  type InputEscopoFoco,
} from "./jornada-foco-inicial";
import { selecionarFocoInicialDoDiagnostico, type SnapshotInicialParsed } from "./jornada-ciclo-inicial";
import {
  JOURNEY_DIAGNOSTIC_TIPO_INICIAL,
  JOURNEY_DIAGNOSTIC_VERSAO,
  type BaselineJornada,
  type DiagnosticoInicialJornada,
} from "./jornada-diagnostico-inicial";
import { templateConceitoBase, templateRevisaoErro } from "./jornada-quest-templates";
import type { BaselineCicloInicial } from "./jornada-ciclo-inicial";

function escopo(
  partial: Partial<InputEscopoFoco> & Pick<InputEscopoFoco, "escopoId" | "escopoLabel">
): InputEscopoFoco {
  return {
    n1: partial.escopoId.split(".")[0] ?? "ing",
    total: 4,
    erros: 3,
    provasComErro: 2,
    pctErro: 0.75,
    tiposErro: {},
    conhecimentosExigidos: [],
    ...partial,
  };
}

const prepositions = escopo({
  escopoId: "ing.grammar.prepositions.meaning",
  escopoLabel: "Prepositions and prepositional meaning",
  total: 4,
  erros: 3,
  provasComErro: 2,
});

const matematica = escopo({
  escopoId: "mat.funcoes.geral.afim",
  escopoLabel: "Função afim",
  total: 12,
  erros: 5,
  provasComErro: 2,
  tiposErro: { CONCEITO_TEORICO: 3 },
  conhecimentosExigidos: ["Identificar coeficiente angular", "Interpretar gráfico"],
});

describe("avaliarQualidadeFocoInicial", () => {
  it("microescopo de inglês com baixa amostra não vence foco estruturante", () => {
    const qPreps = avaliarQualidadeFocoInicial(prepositions, [matematica]);
    const qMat = avaliarQualidadeFocoInicial(matematica, [prepositions]);
    assert.ok(qMat.scoreQualidade > qPreps.scoreQualidade);
    const { escolhido } = selecionarMelhorFocoSemana1([prepositions, matematica]);
    assert.equal(escolhido?.escopoId, matematica.escopoId);
  });

  it("prepositions com 3 erros em 4 questões é rebaixado ou elevado para leitura", () => {
    const q = avaliarQualidadeFocoInicial(prepositions, [matematica]);
    assert.equal(isMicroescopoIngles(prepositions.escopoId, prepositions.escopoLabel), true);
    assert.ok(q.penalizadores.some((p) => p.includes("microescopo") || p.includes("amostra")));

    const elevado = tentarElevarFocoIngles([prepositions], prepositions);
    assert.ok(elevado);
    assert.match(elevado.motivo, /pistas linguísticas/i);
    assert.match(elevado.titulo, /inglês/i);
  });

  it("foco escolhido tem scoreQualidade >= mínimo", () => {
    const { escolhido } = selecionarMelhorFocoSemana1([prepositions, matematica]);
    assert.ok(escolhido);
    const q = avaliarQualidadeFocoInicial(escolhido, [prepositions, matematica]);
    assert.ok(q.scoreQualidade >= SCORE_MINIMO_FOCO_SEMANA1);
    assert.equal(q.aprovado, true);
  });
});

describe("selecionarFocoInicialDoDiagnostico — cenário prepositions vs matemática", () => {
  function snapshot(): SnapshotInicialParsed {
    const escopoMat = "mat.funcoes.geral.afim";
    const escopoIng = "ing.grammar.prepositions.meaning";
    const diagnostico: DiagnosticoInicialJornada = {
      versao: JOURNEY_DIAGNOSTIC_VERSAO,
      tipo: JOURNEY_DIAGNOSTIC_TIPO_INICIAL,
      resumoExecutivo: "x",
      forcas: [],
      fragilidades: [],
      escoposCriticos: [
        {
          escopoId: escopoIng,
          dominioId: "ing.grammar",
          estado: "CRITICO",
          motivo: "Recorrência em 2 provas e 3 erros analisáveis.",
          evidencias: [],
          n3Recorrentes: [],
          tiposErroRelevantes: [],
        },
        {
          escopoId: escopoMat,
          dominioId: "mat.funcoes",
          estado: "CRITICO",
          motivo: "5 erros em função afim.",
          evidencias: [],
          n3Recorrentes: [],
          tiposErroRelevantes: ["CONCEITO_TEORICO"],
        },
      ],
      padroesCognitivos: [],
      influenciaAnamnese: { resumo: "", moduladores: [], limites: [] },
      prioridadesIniciais: [
        {
          ordem: 1,
          escopoId: escopoIng,
          n1: "ing",
          titulo: "Prepositions and prepositional meaning",
          motivo: "Recorrência em 2 provas e 3 erros analisáveis.",
          tipoPrioridade: "CONTEUDO",
        },
        {
          ordem: 2,
          escopoId: escopoMat,
          n1: "mat",
          titulo: "Função afim",
          motivo: "5 erros com padrão conceitual.",
          tipoPrioridade: "CONTEUDO",
        },
      ],
      limitesDaAnalise: [],
    };
    const baseline: BaselineJornada = {
      versao: JOURNEY_DIAGNOSTIC_VERSAO,
      criadoEm: "2026-06-01T12:00:00.000Z",
      porN1: [],
      porEscopo: [
        {
          escopoId: escopoIng,
          dominioId: "ing.grammar",
          total: 4,
          acertos: 1,
          erros: 3,
          pctErro: 75,
          conhecimentosExigidos: [],
          conceitosCanonicos: [],
          tiposErro: {},
          observacoesAluno: [],
          pesoDiagnostico: 12,
          estadoInicial: "CRITICO",
          provasComErro: 2,
        },
        {
          escopoId: escopoMat,
          dominioId: "mat.funcoes",
          total: 12,
          acertos: 7,
          erros: 5,
          pctErro: 42,
          conhecimentosExigidos: ["Coeficiente angular"],
          conceitosCanonicos: [],
          tiposErro: { CONCEITO_TEORICO: 3 },
          observacoesAluno: [],
          pesoDiagnostico: 22,
          estadoInicial: "CRITICO",
          provasComErro: 2,
        },
      ],
      padroesCognitivos: [],
    };
    return {
      id: "snap-1",
      createdAt: new Date(),
      diagnostico,
      baseline,
      narrativa: {
        titulo: "Diagnóstico",
        subtitulo: "",
        mensagemPrincipal: "",
        cards: [],
        avisoLimite: "",
      },
    };
  }

  it("antes: CRITICO em prepositions; depois: prioriza matemática ou eleva inglês", () => {
    const foco = selecionarFocoInicialDoDiagnostico(snapshot());
    const eraPrepositions =
      foco.titulo.toLowerCase().includes("preposition") ||
      foco.motivo.toLowerCase().includes("recorrência em 2 provas");
    if (foco.escopoId?.startsWith("ing.")) {
      assert.equal(foco.focoComposto, true);
      assert.match(foco.titulo, /leitura|pistas/i);
    } else {
      assert.ok(foco.escopoId?.startsWith("mat."));
      assert.ok(!eraPrepositions || foco.motivo.includes("estruturante"));
    }
  });
});

describe("quests de inglês", () => {
  const baseline: BaselineCicloInicial = {
    versao: "1.0",
    origem: "JourneyDiagnosticSnapshot:INICIAL",
    snapshotInicialId: "s",
    criadoEm: "2026-01-01",
    foco: { titulo: "Leitura em inglês", motivo: "x" },
    evidencias: {
      totalQuestoesNoEscopo: 4,
      acertosNoEscopo: 1,
      errosNoEscopo: 3,
      pctErro: 75,
      provasComErro: 2,
      conhecimentosExigidos: [],
      tiposErro: {},
      observacoesAluno: [],
    },
    leitura: {
      problemaPrincipal: "",
      hipoteseDiagnostica: "",
      oQueSeraObservadoNaSemana: "",
      oQueNaoPodeSerConcluidoAinda: "",
    },
  };

  const ctx = {
    cicloId: "c1",
    snapshotId: "s1",
    escopoId: "ing.grammar.prepositions.meaning",
    dominioId: "ing.grammar",
    escopoLabel: "Prepositions and prepositional meaning",
    motivoFoco: "x",
    baseline,
    tiposErro: {},
    conhecimentosExigidos: [],
  };

  it("não usa template genérico de resumo sobre prepositions", () => {
    const q = templateConceitoBase(ctx);
    assert.equal(q.descricao.includes("Escreva um resumo"), false);
    assert.match(q.descricao, /grife/i);
    assert.match(q.descricao, /gabarito/i);
  });

  it("revisão de inglês pede ação textual concreta", () => {
    const q = templateRevisaoErro(ctx);
    assert.match(q.descricao, /plausível|pista|gabarito/i);
  });
});

describe("UI — mini-quiz oculto no fluxo jornada v1", () => {
  it("ciclo-header não mostra fechar ciclo quando fluxoJornadaV1", () => {
    const src = readFileSync(join(process.cwd(), "src/components/ciclo-header.tsx"), "utf8");
    assert.match(src, /fluxoJornadaV1/);
    assert.match(src, /Fechamento semanal e mini-quiz serão liberados/);
    assert.match(src, /Fechar ciclo agora \(mini-quiz\)/);
  });

  it("plano e quests passam fluxoJornadaV1", () => {
    const plano = readFileSync(join(process.cwd(), "src/app/(app)/plano/page.tsx"), "utf8");
    const quests = readFileSync(join(process.cwd(), "src/app/(app)/quests/page.tsx"), "utf8");
    assert.match(plano, /fluxoJornadaV1/);
    assert.match(quests, /fluxoJornadaV1/);
  });
});
