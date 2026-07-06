/**
 * Testes do plano semanal + quests — Etapa 4B.
 * Executar: node --import tsx --test src/lib/jornada-plano-semanal.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import type { StructuredAnamneseProfile } from "./anamnese-types";
import {
  ESCOPO_JORNADA_SEMANAL,
  FONTE_GERACAO_JORNADA_V1,
  AVISO_LIMITE_PLANO_JORNADA,
  parseStudyPlanJornadaItems,
  resolverQuantidadeQuests,
  resolverIdempotenciaPlanoSemanal,
  isQuestJornadaMotor,
} from "./jornada-plano-semanal";
import {
  montarQuestsFromTemplates,
  selecionarTiposQuest,
  templateRevisaoErro,
} from "./jornada-quest-templates";
import { validarQuestJornada } from "./jornada-quest-validador";
import type { BaselineCicloInicial } from "./jornada-ciclo-inicial";

const ROOT = join(import.meta.dirname, "..");

const baseline: BaselineCicloInicial = {
  versao: "1.0",
  origem: "JourneyDiagnosticSnapshot:INICIAL",
  snapshotInicialId: "snap-1",
  criadoEm: "2026-06-01T12:00:00.000Z",
  foco: {
    escopoId: "quim.gases.ideal",
    dominioId: "quim.fisico",
    titulo: "Gases ideais",
    motivo: "Recorrência em duas provas com alto índice de erro em PV=nRT.",
  },
  evidencias: {
    totalQuestoesNoEscopo: 10,
    acertosNoEscopo: 3,
    errosNoEscopo: 7,
    pctErro: 70,
    provasComErro: 2,
    conhecimentosExigidos: ["Aplicar PV=nRT em condições ideais."],
    tiposErro: { CONCEITO_TEORICO: 5, INTERPRETACAO_ENUNCIADO: 2 },
    observacoesAluno: ["Confundi unidade"],
  },
  leitura: {
    problemaPrincipal: "Lacuna conceitual em gases",
    hipoteseDiagnostica: "Confusão entre grandezas e unidades",
    oQueSeraObservadoNaSemana: "Respostas e registros no escopo",
    oQueNaoPodeSerConcluidoAinda: "Domínio global do escopo",
  },
};

const ctxTemplate = {
  cicloId: "ciclo-test-1",
  snapshotId: "snap-1",
  escopoId: "quim.gases.ideal",
  dominioId: "quim.fisico",
  escopoLabel: "Gases ideais",
  motivoFoco: baseline.foco.motivo,
  baseline,
  tiposErro: baseline.evidencias.tiposErro,
  conhecimentosExigidos: baseline.evidencias.conhecimentosExigidos,
};

describe("constantes e contrato StudyPlan", () => {
  it("3. escopo JORNADA_SEMANAL", () => {
    assert.equal(ESCOPO_JORNADA_SEMANAL, "JORNADA_SEMANAL");
  });

  it("4. fonteGeracao motor-jornada-v1", () => {
    assert.equal(FONTE_GERACAO_JORNADA_V1, "motor-jornada-v1");
  });

  it("5. itemsJson contém cicloId", () => {
    const items = {
      versao: "1.0" as const,
      origem: "LearningCycle" as const,
      cicloId: "ciclo-abc",
      foco: { titulo: "Gases", motivo: "x" },
      carga: {
        questsTotal: 3,
        duracaoTotalEstimadaMin: 90,
        intensidade: "PADRAO" as const,
        moduladaPorAnamnese: false,
      },
      blocos: [],
      limites: [AVISO_LIMITE_PLANO_JORNADA],
    };
    const parsed = parseStudyPlanJornadaItems(JSON.stringify(items));
    assert.equal(parsed?.cicloId, "ciclo-abc");
  });

  it("aviso obrigatório em limiteDaInterpretacao", () => {
    assert.ok(AVISO_LIMITE_PLANO_JORNADA.includes("adesão"));
    assert.ok(AVISO_LIMITE_PLANO_JORNADA.includes("nova prova"));
  });
});

describe("quantidade de quests modulada por anamnese", () => {
  it("padrão 3 quests", () => {
    assert.equal(resolverQuantidadeQuests(null).quantidade, 3);
  });

  it("2 quests com rotina baixa/cansaço", () => {
    const profile: StructuredAnamneseProfile = {
      trajectory: {},
      routine: { consistencyLevel: "BAIXA", studyHoursPerDay: "menos de 1h" },
      academicSelfPerception: {},
      examBehavior: { fatigueInLongExams: true },
      metacognition: {},
      emotionalContext: { fearOfNotEnoughTime: true },
    };
    assert.equal(resolverQuantidadeQuests(profile).quantidade, 2);
  });

  it("até 4 quests com autonomia alta", () => {
    const profile: StructuredAnamneseProfile = {
      trajectory: {},
      routine: { consistencyLevel: "ALTA" },
      academicSelfPerception: {},
      examBehavior: {},
      metacognition: { metacognitiveMaturity: "ALTA" },
      emotionalContext: { confidenceLevel: "ALTA" },
    };
    assert.equal(resolverQuantidadeQuests(profile).quantidade, 4);
  });
});

describe("geração determinística de quests", () => {
  it("6. cria entre 2 e 4 quests", () => {
    for (const n of [2, 3, 4]) {
      const tipos = selecionarTiposQuest(baseline.evidencias.tiposErro, n, false);
      const drafts = montarQuestsFromTemplates(ctxTemplate, tipos);
      assert.ok(drafts.length >= 2 && drafts.length <= 4);
    }
  });

  it("7–10. quests têm cicloId, fonte, criterio e escopo", () => {
    const tipos = selecionarTiposQuest(baseline.evidencias.tiposErro, 3, false);
    const drafts = montarQuestsFromTemplates(ctxTemplate, tipos);
    const foco = { escopoId: ctxTemplate.escopoId, titulo: ctxTemplate.escopoLabel };

    for (const d of drafts) {
      assert.ok(d.cicloId);
      assert.ok(d.fonteDiagnosticoJson);
      assert.ok(d.criterioConclusao);
      assert.ok(d.conhecimentoEscopoId || d.fonteDiagnosticoJson.excecaoSemEscopo);
      const v = validarQuestJornada(d, foco);
      assert.equal(v.valida, true, v.motivos.join(", "));
    }
  });

  it("exemplo real de quest gerada", () => {
    const q = templateRevisaoErro(ctxTemplate);
    assert.ok(q.titulo.includes("Gases"));
    assert.ok(q.descricao.includes("Refaça"));
    assert.ok(q.descricao.includes("Concluir quando:"));
    assert.equal(q.fonteDiagnosticoJson.versao, "1.0");
    assert.equal(q.fonteDiagnosticoJson.origem, "LearningCycle");
  });
});

describe("idempotência", () => {
  it("15–16. duplo clique retorna existente", () => {
    assert.equal(
      resolverIdempotenciaPlanoSemanal({ planoExiste: true, questsMotorCount: 3 }),
      "retornar"
    );
    assert.equal(
      resolverIdempotenciaPlanoSemanal({ planoExiste: false, questsMotorCount: 3 }),
      "criar_plano_apenas"
    );
    assert.equal(
      resolverIdempotenciaPlanoSemanal({ planoExiste: false, questsMotorCount: 0 }),
      "criar_completo"
    );
  });
});

describe("isQuestJornadaMotor", () => {
  it("identifica quest do motor v1", () => {
    assert.equal(
      isQuestJornadaMotor({
        cicloId: "c1",
        fonteDiagnosticoJson: JSON.stringify({
          versao: "1.0",
          origem: "LearningCycle",
          cicloId: "c1",
          motivo: "x",
          criterioConclusao: "y",
        }),
      }),
      true
    );
    assert.equal(isQuestJornadaMotor({ cicloId: null, fonteDiagnosticoJson: null }), false);
  });
});

describe("bloqueios e ausência de legado", () => {
  it("1–2. erros sem ciclo ou diagnóstico (contrato API)", () => {
    const route = readFileSync(join(ROOT, "app/api/jornada/plano/gerar/route.ts"), "utf8");
    const motor = readFileSync(join(ROOT, "lib/jornada-plano-semanal.ts"), "utf8");
    assert.ok(motor.includes("Nenhum ciclo ativo encontrado"));
    assert.ok(motor.includes("Diagnóstico Inicial não encontrado"));
    assert.ok(route.includes("gerarOuObterPlanoSemanalJornada"));
  });

  it("19. não chama aplicarPlanoEQuests", () => {
    const src = readFileSync(join(ROOT, "lib/jornada-plano-semanal.ts"), "utf8");
    assert.equal(src.includes("aplicarPlanoEQuests"), false);
    assert.equal(src.includes("regenerarPlanoGlobalUsuario"), false);
    assert.equal(src.includes("persistirQuestsIA"), false);
    assert.equal(src.includes("garantirQuestsAlavanca"), false);
  });

  it("20. não chama sincronizarCicloDaSemana", () => {
    const src = readFileSync(join(ROOT, "lib/jornada-plano-semanal.ts"), "utf8");
    assert.equal(src.includes("sincronizarCicloDaSemana"), false);
    assert.equal(src.includes("abrirOuRenovarCiclo"), false);
  });

  it("não usa escopo GLOBAL", () => {
    const src = readFileSync(join(ROOT, "lib/jornada-plano-semanal.ts"), "utf8");
    assert.equal(src.includes('"GLOBAL"'), false);
    assert.ok(src.includes("JORNADA_SEMANAL"));
  });

  it("não cria mini-quiz nem fecha ciclo", () => {
    const src = readFileSync(join(ROOT, "lib/jornada-plano-semanal.ts"), "utf8");
    assert.equal(src.includes("cicloQuiz"), false);
    assert.equal(src.includes("resultadoJson"), false);
    assert.equal(src.includes("narrativaFimJson"), false);
    assert.equal(src.includes("JourneyDiagnosticSnapshot.create"), false);
  });
});

describe("conclusão de quest não altera diagnóstico", () => {
  it("17–18. PATCH quests não toca snapshot nem LearningCycle", () => {
    const route = readFileSync(join(ROOT, "app/api/quests/route.ts"), "utf8");
    assert.equal(route.includes("JourneyDiagnosticSnapshot"), false);
    assert.equal(route.includes("resultadoJson"), false);
    assert.equal(route.includes("baselineJson"), false);
    assert.equal(route.includes("narrativaFimJson"), false);
    assert.ok(route.includes("quest.update"));
  });
});

describe("UI e API", () => {
  it("API POST /api/jornada/plano/gerar", () => {
    const route = readFileSync(join(ROOT, "app/api/jornada/plano/gerar/route.ts"), "utf8");
    assert.ok(route.includes("gerarOuObterPlanoSemanalJornada"));
    assert.ok(route.includes("jaExistia") || route.includes("resultado"));
  });

  it("componente JornadaPlanoSemanalCard", () => {
    const card = readFileSync(join(ROOT, "components/jornada-plano-semanal-card.tsx"), "utf8");
    assert.ok(card.includes("limiteDaInterpretacao"));
    assert.ok(card.includes("GerarPlanoJornadaButton"));
  });
});
