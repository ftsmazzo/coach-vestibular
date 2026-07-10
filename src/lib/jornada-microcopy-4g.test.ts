/**
 * Etapa 4G — microcopy final Semana 1.
 * Executar: node --import tsx --test src/lib/jornada-microcopy-4g.test.ts
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
  formatarErros,
  formatarProvas,
  formatarQuestoes,
  textoCriterioConclusaoExibicao,
} from "./jornada-labels";
import { templateRevisaoErro, type ContextoTemplateQuest } from "./jornada-quest-templates";
import type { BaselineCicloInicial } from "./jornada-ciclo-inicial";
import type { BaselineEscopoJornada } from "./jornada-diagnostico-inicial";

const ESCOPO_SOMA = "mat.geometria_plana.angulos_poligonos.soma_angulos";
const LABEL_SOMA = "Soma de ângulos em figuras planas";
const ESCOPO_ING = "ing.preposicoes";
const LABEL_ING = "Prepositions and prepositional meaning";

function evidencia(escopoId: string, label: string, erros: number, total: number): EvidenciaCanonicaFoco {
  return {
    escopoId,
    label,
    total,
    acertos: total - erros,
    erros,
    pctErro: total > 0 ? Math.round((erros / total) * 100) : 0,
    provasComErro: 2,
    provasComQuestao: 2,
    ocorrenciasPorProva: [
      { examId: "e1", nome: "FAMERP", total: 1, erros: 1, numerosErradas: [8] },
      { examId: "e2", nome: "UNESP", total: erros - 1, erros: erros - 1, numerosErradas: [87] },
    ],
    n3Recorrentes: [],
    tiposErro: { CONCEITO_TEORICO: erros },
  };
}

function linha(escopoId: string, erros: number, total: number): BaselineEscopoJornada {
  return {
    escopoId,
    total,
    acertos: total - erros,
    erros,
    pctErro: total > 0 ? Math.round((erros / total) * 100) : 0,
    conhecimentosExigidos: [],
    conceitosCanonicos: [],
    tiposErro: { CONCEITO_TEORICO: erros },
    observacoesAluno: [],
    pesoDiagnostico: 20,
    estadoInicial: "FRAGILIDADE",
    provasComErro: 2,
  };
}

const ARTIFICIAL = ["erro(s)", "questão(ões)", "prova(s)"];

function assertSemPluralArtificial(texto: string) {
  for (const p of ARTIFICIAL) {
    assert.equal(texto.includes(p), false, `encontrou "${p}" em: ${texto}`);
  }
}

describe("Etapa 4G — microcopy", () => {
  const evSoma = evidencia(ESCOPO_SOMA, LABEL_SOMA, 3, 3);
  const evIng = evidencia(ESCOPO_ING, LABEL_ING, 3, 4);
  const hipotese = inferirHipotesePedagogicaFoco(evSoma, LABEL_SOMA);

  it("1. não exibe pluralização artificial em textos de aluno", () => {
    assert.equal(formatarErros(1), "1 erro");
    assert.equal(formatarErros(3), "3 erros");
    assert.equal(formatarQuestoes(1), "1 questão");
    assert.equal(formatarQuestoes(3), "3 questões");
    assert.equal(formatarProvas(1), "1 prova");
    assert.equal(formatarProvas(2), "2 provas");

    const textos = [
      motivoPrioridadeInicial(LABEL_SOMA, evSoma, "primaria"),
      motivoPrioridadeInicial(LABEL_ING, evIng, "secundaria"),
      formatarEvidenciaFocoAgregada(evSoma, { nomesCurtos: true }),
      hipotese.narrativaSemana,
      hipotese.motivoDiagnostico,
      hipotese.baselineEvidencia,
      montarResumoExecutivoDiagnostico({
        provas: 2,
        questoes: 120,
        pctAcerto: 72,
        escoposCriticos: [],
        prioridades: [
          { ordem: 1, titulo: LABEL_SOMA, motivo: "", tipoPrioridade: "CONTEUDO" },
        ],
        forcas: [],
        moduladoresAnamnese: [],
        confirmacoesAnamnese: [],
        evidenciaPrioridade: evSoma,
        hipotesePrioridade: hipotese,
      }),
    ];
    for (const t of textos) assertSemPluralArtificial(t);
  });

  it("2. não exibe Concluir quando: Concluir quando", () => {
    assert.equal(
      textoCriterioConclusaoExibicao("Concluir quando tiver refeito as questões."),
      "tiver refeito as questões."
    );
    assert.equal(
      textoCriterioConclusaoExibicao("Concluir quando: tiver marcado a figura."),
      "tiver marcado a figura."
    );
    const exibicao = `Concluir quando: ${textoCriterioConclusaoExibicao("Concluir quando tiver refeito.")}`;
    assert.equal(exibicao.includes("Concluir quando: Concluir quando"), false);
  });

  it("3–4. só prioridade 1 usa primeira hipótese; secundárias usam atenção secundária", () => {
    const mapa = new Map([
      [ESCOPO_SOMA, evSoma],
      [ESCOPO_ING, evIng],
    ]);
    const prioridades = montarPrioridadesDiagnostico(
      [linha(ESCOPO_SOMA, 3, 3), linha(ESCOPO_ING, 3, 4)],
      [],
      [],
      [],
      [],
      mapa
    );
    assert.ok(prioridades.length >= 1);
    assert.ok(prioridades[0]!.motivo.includes("primeira hipótese de intervenção"));
    assertSemPluralArtificial(prioridades[0]!.motivo);

    for (const p of prioridades.slice(1)) {
      assert.equal(
        p.motivo.includes("primeira hipótese de intervenção"),
        false,
        p.motivo
      );
      assert.ok(
        p.motivo.includes("atenção secundária") ||
          p.motivo.includes("sinal secundário") ||
          p.motivo.includes("monitorar"),
        p.motivo
      );
      assertSemPluralArtificial(p.motivo);
    }

    const sec = motivoPrioridadeInicial(LABEL_ING, evIng, "secundaria");
    assert.ok(sec.includes("atenção secundária"));
    assert.ok(sec.includes("3 erros em 4 questões"));
    assert.equal(sec.includes("primeira hipótese"), false);
  });

  it("5. resumo executivo mais curto e sem plural artificial", () => {
    const resumo = montarResumoExecutivoDiagnostico({
      provas: 2,
      questoes: 120,
      pctAcerto: 72,
      escoposCriticos: [],
      prioridades: [
        { ordem: 1, titulo: LABEL_SOMA, motivo: "", tipoPrioridade: "CONTEUDO" },
      ],
      forcas: [{ titulo: "Física", descricao: "", evidencias: [], escoposAssociados: [] }],
      moduladoresAnamnese: [],
      confirmacoesAnamnese: [],
      evidenciaPrioridade: evSoma,
      hipotesePrioridade: hipotese,
      atencaoSecundaria: "Inglês segue como atenção secundária",
    });
    assertSemPluralArtificial(resumo);
    assert.ok(resumo.includes("foco inicial"));
    assert.ok(resumo.includes("3 erros em 3 questões"));
    assert.equal(resumo.includes("distribuídos em 2 provas ("), false);
    assert.ok(resumo.length < 320);
  });

  it("6. quest critério sem prefixo duplicável", () => {
    const hipoteseLocal = inferirHipotesePedagogicaFoco(evSoma, LABEL_SOMA);
    const baseline: BaselineCicloInicial = {
      versao: "1.0",
      origem: "JourneyDiagnosticSnapshot:INICIAL",
      snapshotInicialId: "s",
      criadoEm: "2026-07-01T12:00:00.000Z",
      hipotese: hipoteseLocal,
      foco: { escopoId: ESCOPO_SOMA, titulo: LABEL_SOMA, motivo: "" },
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
        hipoteseDiagnostica: "",
        oQueSeraObservadoNaSemana: "",
        oQueNaoPodeSerConcluidoAinda: "",
      },
    };
    const ctx: ContextoTemplateQuest = {
      cicloId: "c",
      snapshotId: "s",
      escopoId: ESCOPO_SOMA,
      dominioId: null,
      escopoLabel: LABEL_SOMA,
      motivoFoco: "",
      hipotese: hipoteseLocal,
      baseline,
      tiposErro: {},
      conhecimentosExigidos: [],
    };
    const q = templateRevisaoErro(ctx);
    assert.equal(q.criterioConclusao.toLowerCase().startsWith("concluir quando"), false);
    assert.equal(
      `Concluir quando: ${q.criterioConclusao}`.includes("Concluir quando: Concluir quando"),
      false
    );
  });
});
