/**
 * Etapa 4E — testes da hipótese pedagógica e narrativa canônica.
 * Executar: node --import tsx --test src/lib/jornada-hipotese-pedagogica.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EvidenciaCanonicaFoco } from "./jornada-evidencia-canonica";
import { montarResumoExecutivoDiagnostico } from "./jornada-diagnostico-sintese";
import {
  inferirForcaDaEvidencia,
  inferirHipotesePedagogicaFoco,
  motivoQuestConceitoBase,
} from "./jornada-hipotese-pedagogica";
import {
  montarBaselineCicloInicial,
  montarNarrativaInicioCiclo,
  selecionarFocoInicialDoDiagnostico,
  type SnapshotInicialParsed,
} from "./jornada-ciclo-inicial";
import {
  JOURNEY_DIAGNOSTIC_TIPO_INICIAL,
  JOURNEY_DIAGNOSTIC_VERSAO,
  AVISO_DIAGNOSTICO_INICIAL_BETA,
  type DiagnosticoInicialJornada,
  type BaselineJornada,
  type NarrativaDiagnosticoInicial,
} from "./jornada-diagnostico-inicial";
import {
  templateConceitoBase,
  templateRevisaoErro,
  type ContextoTemplateQuest,
} from "./jornada-quest-templates";
import type { BaselineCicloInicial } from "./jornada-ciclo-inicial";

const ESCOPO_SOMA = "mat.geometria_plana.angulos_poligonos.soma_angulos";
const LABEL_SOMA = "Soma de ângulos em figuras planas";

function evidenciaFrederico(): EvidenciaCanonicaFoco {
  return {
    escopoId: ESCOPO_SOMA,
    label: LABEL_SOMA,
    total: 3,
    acertos: 0,
    erros: 3,
    pctErro: 100,
    provasComErro: 2,
    provasComQuestao: 2,
    ocorrenciasPorProva: [
      {
        examId: "e1",
        nome: "Simulado FAMERP — 2026 — Hexag - Dia 1",
        total: 1,
        erros: 1,
        numerosErradas: [8],
      },
      {
        examId: "e2",
        nome: "UNESP — 2026 — Meio de Ano - Conhecimentos Gerais",
        total: 2,
        erros: 2,
        numerosErradas: [87, 89],
      },
    ],
    n3Recorrentes: [],
    tiposErro: { CONCEITO_TEORICO: 2, INTERPRETACAO_ENUNCIADO: 1 },
  };
}

function snapshotSomaAngulos(): SnapshotInicialParsed {
  const escopoId = ESCOPO_SOMA;
  const diagnostico: DiagnosticoInicialJornada = {
    versao: JOURNEY_DIAGNOSTIC_VERSAO,
    tipo: JOURNEY_DIAGNOSTIC_TIPO_INICIAL,
    qualidade: "BETA",
    resumoExecutivo: "",
    forcas: [
      {
        titulo: "Física",
        descricao: "Estável na amostra",
        evidencias: [],
        escoposAssociados: [],
      },
    ],
    fragilidades: [],
    escoposCriticos: [],
    padroesCognitivos: [],
    influenciaAnamnese: { resumo: "", moduladores: [], limites: [] },
    prioridadesIniciais: [
      {
        ordem: 1,
        escopoId,
        n1: "matematica",
        titulo: LABEL_SOMA,
        motivo: "Sinal inicial",
        tipoPrioridade: "CONTEUDO",
      },
      {
        ordem: 2,
        escopoId: "ing.preposicoes",
        n1: "ingles",
        titulo: "Prepositions and prepositional meaning",
        motivo: "Microtópico recorrente",
        tipoPrioridade: "CONTEUDO",
      },
    ],
    limitesDaAnalise: [],
  };
  const baseline: BaselineJornada = {
    versao: JOURNEY_DIAGNOSTIC_VERSAO,
    criadoEm: "2026-07-01T12:00:00.000Z",
    porN1: [],
    porEscopo: [
      {
        escopoId,
        total: 3,
        acertos: 0,
        erros: 3,
        pctErro: 100,
        conhecimentosExigidos: [],
        conceitosCanonicos: [],
        tiposErro: { CONCEITO_TEORICO: 2 },
        observacoesAluno: [],
        pesoDiagnostico: 20,
        estadoInicial: "FRAGILIDADE",
        provasComErro: 2,
      },
    ],
    padroesCognitivos: [],
  };
  const narrativa: NarrativaDiagnosticoInicial = {
    titulo: "Diagnóstico Inicial",
    subtitulo: "2 provas",
    mensagemPrincipal: "",
    cards: [],
    avisoLimite: "Este é o marco zero da sua Jornada — não será sobrescrito automaticamente.",
  };
  return {
    id: "snap-1",
    createdAt: new Date("2026-07-01"),
    diagnostico,
    baseline,
    narrativa,
  };
}

function ctxSomaAngulos(hipotese = inferirHipotesePedagogicaFoco(evidenciaFrederico(), LABEL_SOMA)): ContextoTemplateQuest {
  const baseline: BaselineCicloInicial = {
    versao: "1.0",
    origem: "JourneyDiagnosticSnapshot:INICIAL",
    snapshotInicialId: "snap-1",
    criadoEm: "2026-07-01T12:00:00.000Z",
    hipotese,
    foco: { escopoId: ESCOPO_SOMA, titulo: LABEL_SOMA, motivo: hipotese.motivoDiagnostico },
    evidencias: {
      totalQuestoesNoEscopo: 3,
      acertosNoEscopo: 0,
      errosNoEscopo: 3,
      pctErro: 100,
      provasComErro: 2,
      conhecimentosExigidos: [],
      tiposErro: {},
      observacoesAluno: [],
    },
    leitura: {
      problemaPrincipal: "",
      hipoteseDiagnostica: hipotese.hipotese,
      oQueSeraObservadoNaSemana: hipotese.objetivoDaSemana,
      oQueNaoPodeSerConcluidoAinda: hipotese.cuidadoInterpretativo,
      motivoQuest: hipotese.motivoQuest,
    },
  };
  return {
    cicloId: "ciclo-1",
    snapshotId: "snap-1",
    escopoId: ESCOPO_SOMA,
    dominioId: null,
    escopoLabel: LABEL_SOMA,
    motivoFoco: hipotese.motivoSemana,
    motivoQuest: hipotese.motivoQuest,
    hipotese,
    baseline,
    tiposErro: {},
    conhecimentosExigidos: [],
  };
}

describe("inferirHipotesePedagogicaFoco — caso Frederico", () => {
  const ev = evidenciaFrederico();
  const hipotese = inferirHipotesePedagogicaFoco(ev, LABEL_SOMA);

  it("1. força INICIAL ou MODERADA, não conclusão definitiva", () => {
    const forca = inferirForcaDaEvidencia(ev);
    assert.ok(forca === "INICIAL" || forca === "MODERADA");
    assert.notEqual(forca, "FORTE");
    assert.ok(hipotese.cuidadoInterpretativo.includes("amostra"));
    assert.ok(hipotese.motivoDiagnostico.includes("não deve ser lida como conclusão definitiva"));
  });

  it("2. diagnóstico usa hipótese de intervenção, não eixo mais urgente", () => {
    const resumo = montarResumoExecutivoDiagnostico({
      provas: 2,
      questoes: 170,
      pctAcerto: 45,
      escoposCriticos: [],
      prioridades: [{ ordem: 1, titulo: LABEL_SOMA, motivo: "", tipoPrioridade: "CONTEUDO" }],
      forcas: [{ titulo: "Física", descricao: "", evidencias: [], escoposAssociados: [] }],
      moduladoresAnamnese: [],
      confirmacoesAnamnese: [],
      evidenciaPrioridade: ev,
      hipotesePrioridade: hipotese,
      atencaoSecundaria: "Inglês segue como atenção secundária por recorrência em microtópicos",
    });
    assert.ok(resumo.includes("sinal inicial mais consistente"));
    assert.ok(resumo.includes("hipótese de intervenção"));
    assert.equal(resumo.includes("eixo mais urgente"), false);
    assert.equal(resumo.includes("fragilidade consolidada"), false);
  });

  it("3–5. Semana 1 cita evidência, amostra pequena e hipótese", () => {
    const snap = snapshotSomaAngulos();
    const foco = selecionarFocoInicialDoDiagnostico(snap);
    const narrativa = montarNarrativaInicioCiclo(snap, foco, { hipotese });
    const baseline = montarBaselineCicloInicial(snap, foco, { evidencia: ev, hipotese });

    assert.ok(narrativa.mensagem.includes("3 erro"));
    assert.ok(narrativa.mensagem.includes("somando"));
    assert.ok(
      baseline.leitura.baselineEvidencia?.includes("FAMERP") ||
        baseline.leitura.baselineEvidencia?.includes("UNESP")
    );
    assert.ok(
      narrativa.mensagem.includes("relação angular") ||
        narrativa.hipotesePedagogica?.includes("relação angular")
    );
    assert.ok(baseline.leitura.baselineEvidencia?.includes("3 erro"));
    assert.ok(
      baseline.leitura.oQueNaoPodeSerConcluidoAinda.includes("amostra") ||
        hipotese.cuidadoInterpretativo.includes("amostra")
    );
  });
});

describe("quests de soma de ângulos", () => {
  const ctx = ctxSomaAngulos();
  const revisao = templateRevisaoErro(ctx);
  const conceito = templateConceitoBase(ctx);

  it("6. REVISAO_ERRO pede marcação, relação angular e equação", () => {
    assert.ok(revisao.titulo.toLowerCase().includes("marcação"));
    assert.ok(revisao.descricao.includes("marque na figura"));
    assert.ok(revisao.descricao.includes("relação"));
    assert.ok(revisao.descricao.includes("equação"));
    assert.equal(revisao.descricao.includes("Concluir quando:"), false);
    assert.ok(revisao.descricao.includes("Q8 da FAMERP"));
    assert.ok(revisao.descricao.includes("Q87/Q89 da UNESP"));
  });

  it("7–8. CONCEITO_BASE não usa resumo genérico e pede desenho/equação", () => {
    assert.equal(conceito.descricao.includes("resumo de 6 a 8 linhas"), false);
    assert.ok(conceito.titulo.includes("relações angulares"));
    assert.ok(conceito.descricao.includes("desenhe"));
    assert.ok(conceito.descricao.includes("equação"));
  });

  it("9. motivo da quest não repete motivo de seleção com inglês", () => {
    const motivoRevisao = revisao.fonteDiagnosticoJson.motivo ?? "";
    const motivoConceito = conceito.fonteDiagnosticoJson.motivo ?? "";
    assert.ok(motivoRevisao.includes("FAMERP") || motivoRevisao.includes("UNESP"));
    assert.equal(motivoRevisao.includes("preposition"), false);
    assert.equal(motivoConceito, motivoQuestConceitoBase(ctx.hipotese!, ESCOPO_SOMA, LABEL_SOMA));
    assert.notEqual(motivoConceito, motivoRevisao);
  });
});

describe("aviso BETA único", () => {
  it("10. avisoLimite do snapshot não repete texto BETA (fica só no card)", () => {
    const narrativa = snapshotSomaAngulos().narrativa;
    assert.equal(narrativa.avisoLimite.includes(AVISO_DIAGNOSTICO_INICIAL_BETA), false);
    assert.ok(narrativa.avisoLimite.includes("marco zero"));
  });
});
