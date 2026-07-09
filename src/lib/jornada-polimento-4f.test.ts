/**
 * Etapa 4F — polimento UI/texto Semana 1.
 * Executar: node --import tsx --test src/lib/jornada-polimento-4f.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { EvidenciaCanonicaFoco } from "./jornada-evidencia-canonica";
import { formatarEvidenciaFocoAgregada } from "./jornada-evidencia-canonica";
import {
  montarPrioridadesDiagnostico,
  montarResumoExecutivoDiagnostico,
} from "./jornada-diagnostico-sintese";
import {
  inferirHipotesePedagogicaFoco,
  motivoPrioridadeInicial,
} from "./jornada-hipotese-pedagogica";
import {
  abreviarNomeProva,
  formatarRotuloMateriaCiclo,
  labelMateriaEscopo,
} from "./jornada-labels";
import { descricaoQuestSemCriterioDuplicado } from "./jornada-plano-semanal";
import {
  montarNarrativaInicioCiclo,
  type FocoInicialJornada,
} from "./jornada-ciclo-inicial";
import { templateRevisaoErro, type ContextoTemplateQuest } from "./jornada-quest-templates";
import type { BaselineCicloInicial } from "./jornada-ciclo-inicial";
import type { BaselineEscopoJornada } from "./jornada-diagnostico-inicial";

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

function linhaBaselineSoma(): BaselineEscopoJornada {
  return {
    escopoId: ESCOPO_SOMA,
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
  };
}

function ctxQuestFrederico(): ContextoTemplateQuest {
  const hipotese = inferirHipotesePedagogicaFoco(evidenciaFrederico(), LABEL_SOMA);
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
      resumoPlano: hipotese.resumoPlano,
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

describe("Etapa 4F — polimento UI/texto", () => {
  const ev = evidenciaFrederico();
  const hipotese = inferirHipotesePedagogicaFoco(ev, LABEL_SOMA);
  const evidenciaPorEscopo = new Map([[ESCOPO_SOMA, ev]]);

  it("1. prioridades iniciais usam evidência canônica (3 erros, não 2)", () => {
    const prioridades = montarPrioridadesDiagnostico(
      [linhaBaselineSoma()],
      [
        {
          escopoId: ESCOPO_SOMA,
          escopoLabel: LABEL_SOMA,
          materiaId: "mat",
          erros: 2,
          total: 2,
          prioridadeScore: 10,
          recorrencia: 2,
        },
      ],
      [],
      [],
      [],
      evidenciaPorEscopo
    );
    const motivo = prioridades[0]?.motivo ?? "";
    assert.ok(motivo.includes("3 erro(s) em 3 questão(ões)"));
    assert.equal(motivo.includes("2 erro(s)"), false);
    assert.ok(motivo.includes("primeira hipótese de intervenção"));
  });

  it("2. resumo executivo não contém ', Como'", () => {
    const resumo = montarResumoExecutivoDiagnostico({
      provas: 2,
      questoes: 120,
      pctAcerto: 72,
      escoposCriticos: [],
      prioridades: [
        {
          ordem: 1,
          escopoId: ESCOPO_SOMA,
          titulo: LABEL_SOMA,
          motivo: motivoPrioridadeInicial(LABEL_SOMA, ev),
          tipoPrioridade: "CONTEUDO",
        },
      ],
      forcas: [{ titulo: "Física", descricao: "", evidencias: [], escoposAssociados: [] }],
      moduladoresAnamnese: [],
      confirmacoesAnamnese: [],
      evidenciaPrioridade: ev,
      hipotesePrioridade: hipotese,
    });
    assert.equal(resumo.includes(", Como"), false);
    assert.ok(resumo.includes(". Como"));
  });

  it("3. resumo executivo usa nomes curtos de prova", () => {
    const detalhe = formatarEvidenciaFocoAgregada(ev, { nomesCurtos: true });
    assert.ok(detalhe.includes("FAMERP"));
    assert.ok(detalhe.includes("UNESP"));
    assert.equal(detalhe.includes("Meio de Ano - Conhecimentos Gerais"), false);
    assert.equal(detalhe.includes("Hexag - Dia 1"), false);
    assert.equal(abreviarNomeProva("Simulado FAMERP — 2026 — Hexag - Dia 1"), "FAMERP");
  });

  it("4. plano não repete literalmente a narrativa completa da Semana 1", () => {
    const foco: FocoInicialJornada = {
      escopoId: ESCOPO_SOMA,
      dominioId: null,
      titulo: LABEL_SOMA,
      motivo: hipotese.motivoDiagnostico,
      materiaLabel: "Matemática",
      conceitosCanonicos: [],
      tiposErro: {},
      padroesCognitivos: [],
      origem: "PRIORIDADE",
    };
    const narrativa = montarNarrativaInicioCiclo(
      {
        id: "s",
        createdAt: new Date(),
        diagnostico: {} as never,
        baseline: {} as never,
        narrativa: {} as never,
      },
      foco,
      { hipotese }
    );
    assert.notEqual(hipotese.resumoPlano, narrativa.mensagem);
    assert.ok(hipotese.resumoPlano.includes("duas tarefas práticas"));
    assert.equal(hipotese.resumoPlano.includes("Evidência inicial:"), false);
    assert.ok(narrativa.mensagem.includes("Evidência inicial:"));
  });

  it("5. quest não exibe Concluir quando duplicado na descrição", () => {
    const revisao = templateRevisaoErro(ctxQuestFrederico());
    const limpa = descricaoQuestSemCriterioDuplicado(
      `${revisao.descricao}\n\nConcluir quando: ${revisao.criterioConclusao}`
    );
    assert.equal(revisao.descricao.includes("Concluir quando:"), false);
    assert.equal(limpa.includes("Concluir quando:"), false);
    assert.ok(revisao.criterioConclusao.length > 0);
  });

  it("6–7. REVISAO_ERRO inclui questões específicas por prova", () => {
    const revisao = templateRevisaoErro(ctxQuestFrederico());
    assert.ok(revisao.descricao.includes("Q8 da FAMERP"));
    assert.ok(revisao.descricao.includes("Q87/Q89 da UNESP"));
  });

  it("8–9. UI não exibe código interno mat", () => {
    assert.equal(labelMateriaEscopo(ESCOPO_SOMA), "Matemática");
    const rotulo = formatarRotuloMateriaCiclo("mat", ESCOPO_SOMA, `Semana 1: ${LABEL_SOMA}`);
    assert.ok(rotulo?.includes("Matemática"));
    assert.equal(rotulo?.includes(" mat"), false);
    assert.ok(rotulo?.includes("Geometria plana"));
  });

  it("10. motivoPrioridadeInicial alinhado ao texto esperado (apresentação)", () => {
    const motivo = motivoPrioridadeInicial(LABEL_SOMA, ev);
    assert.ok(motivo.startsWith(`${LABEL_SOMA} aparece como primeira hipótese de intervenção:`));
    assert.ok(motivo.includes("amostra ainda é pequena"));
    assert.equal(motivo.includes("concentrou"), false);
  });
});
