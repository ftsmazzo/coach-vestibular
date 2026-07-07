/**
 * Testes do primeiro LearningCycle (Semana 1) — Etapa 3.
 * Executar: node --import tsx --test src/lib/jornada-ciclo-inicial.test.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it } from "node:test";
import {
  JOURNEY_DIAGNOSTIC_TIPO_INICIAL,
  JOURNEY_DIAGNOSTIC_VERSAO,
  type BaselineJornada,
  type DiagnosticoInicialJornada,
  type NarrativaDiagnosticoInicial,
} from "./jornada-diagnostico-inicial";
import {
  criarOuObterPrimeiroCicloJornada,
  montarBaselineCicloInicial,
  montarNarrativaInicioCiclo,
  resolverAcaoCicloInicial,
  selecionarFocoInicialDoDiagnostico,
  type SnapshotInicialParsed,
} from "./jornada-ciclo-inicial";

const ROOT = join(import.meta.dirname, "..");

function snapshotParsed(
  overrides: Partial<{
    diagnostico: Partial<DiagnosticoInicialJornada>;
    baseline: Partial<BaselineJornada>;
  }> = {}
): SnapshotInicialParsed {
  const escopoId = "quim.gases.ideal";
  const diagnostico: DiagnosticoInicialJornada = {
    versao: JOURNEY_DIAGNOSTIC_VERSAO,
    tipo: JOURNEY_DIAGNOSTIC_TIPO_INICIAL,
    resumoExecutivo: "Resumo teste",
    forcas: [],
    fragilidades: [],
    escoposCriticos: [
      {
        escopoId,
        dominioId: "quim.fisico",
        estado: "CRITICO",
        motivo: "Recorrência em duas provas com alto índice de erro.",
        evidencias: ["Prova A Q12", "Prova B Q8"],
        n3Recorrentes: ["PV=nRT"],
        tiposErroRelevantes: ["CONCEITO_TEORICO"],
      },
    ],
    padroesCognitivos: [
      {
        titulo: "Lacuna conceitual",
        descricao: "Erros sugerem falta de domínio do conceito base.",
        evidencias: [escopoId],
      },
    ],
    influenciaAnamnese: { resumo: "x", moduladores: [], limites: [] },
    prioridadesIniciais: [
      {
        ordem: 1,
        escopoId,
        n1: "quimica",
        titulo: "Gases ideais",
        motivo: "Prioridade inicial do diagnóstico.",
        tipoPrioridade: "CONTEUDO",
      },
    ],
    limitesDaAnalise: [],
    ...overrides.diagnostico,
  };

  const baseline: BaselineJornada = {
    versao: JOURNEY_DIAGNOSTIC_VERSAO,
    criadoEm: "2026-06-01T12:00:00.000Z",
    porN1: [],
    porEscopo: [
      {
        escopoId,
        dominioId: "quim.fisico",
        total: 10,
        acertos: 3,
        erros: 7,
        pctErro: 70,
        conhecimentosExigidos: ["Aplicar PV=nRT."],
        conceitosCanonicos: ["Lei dos gases ideais"],
        tiposErro: { CONCEITO_TEORICO: 5, INTERPRETACAO_ENUNCIADO: 2 },
        observacoesAluno: ["Confundi unidade"],
        pesoDiagnostico: 1,
        estadoInicial: "CRITICO",
        provasComErro: 2,
      },
    ],
    padroesCognitivos: [],
    ...overrides.baseline,
  };

  const narrativa: NarrativaDiagnosticoInicial = {
    titulo: "Diagnóstico Inicial",
    subtitulo: "Com base em 2 provas",
    mensagemPrincipal: "Mensagem",
    cards: [],
    avisoLimite: "Aviso",
  };

  return {
    id: "snap-test-001",
    createdAt: new Date("2026-06-01T12:00:00.000Z"),
    diagnostico,
    baseline,
    narrativa,
  };
}

describe("criarOuObterPrimeiroCicloJornada — pré-condições", () => {
  it("1. não cria ciclo sem Diagnóstico Inicial", async () => {
    await assert.rejects(
      () =>
        criarOuObterPrimeiroCicloJornada("user-sem-snapshot", {
          id: "snap-invalido",
          createdAt: new Date(),
          tipo: "POS_PROVA",
          diagnosticoJson: "{}",
          baselineJson: null,
          narrativaJson: null,
        } as Parameters<typeof criarOuObterPrimeiroCicloJornada>[1]),
      /SEM_DIAGNOSTICO_INICIAL/
    );
  });
});

describe("seleção de foco da Semana 1", () => {
  it("8. metaEscopoId vem de prioridadesIniciais / escopo crítico", () => {
    const snap = snapshotParsed();
    const foco = selecionarFocoInicialDoDiagnostico(snap);
    assert.equal(foco.escopoId, "quim.gases.ideal");
    assert.equal(foco.origem, "CRITICO");
  });

  it("prioriza CRITICO sobre FRAGILIDADE", () => {
    const snap = snapshotParsed({
      diagnostico: {
        escoposCriticos: [
          {
            escopoId: "mat.geometria.plana",
            estado: "FRAGILIDADE",
            motivo: "fragil",
            evidencias: [],
            n3Recorrentes: [],
            tiposErroRelevantes: [],
          },
          {
            escopoId: "quim.gases.ideal",
            estado: "CRITICO",
            motivo: "critico",
            evidencias: [],
            n3Recorrentes: [],
            tiposErroRelevantes: [],
          },
        ],
      },
    });
    const foco = selecionarFocoInicialDoDiagnostico(snap);
    assert.equal(foco.escopoId, "quim.gases.ideal");
    assert.equal(foco.origem, "CRITICO");
  });

  it("sem escopo confiável usa prioridade cognitiva", () => {
    const snap = snapshotParsed({
      diagnostico: {
        escoposCriticos: [],
        prioridadesIniciais: [
          {
            ordem: 1,
            titulo: "Ritmo de estudo",
            motivo: "Anamnese indica dificuldade de constância.",
            tipoPrioridade: "ROTINA",
          },
        ],
      },
      baseline: { porEscopo: [] },
    });
    const foco = selecionarFocoInicialDoDiagnostico(snap);
    assert.equal(foco.escopoId, null);
    assert.equal(foco.origem, "ORGANIZACAO");
  });
});

describe("baseline e narrativa do ciclo", () => {
  it("2/9/10. baseline referencia snapshot inicial e recorte do foco", () => {
    const snap = snapshotParsed();
    const foco = selecionarFocoInicialDoDiagnostico(snap);
    const baseline = montarBaselineCicloInicial(snap, foco);

    assert.equal(baseline.versao, "1.0");
    assert.equal(baseline.origem, "JourneyDiagnosticSnapshot:INICIAL");
    assert.equal(baseline.snapshotInicialId, "snap-test-001");
    assert.equal(baseline.foco.escopoId, "quim.gases.ideal");
    assert.equal(baseline.evidencias.errosNoEscopo, 7);
    assert.equal(baseline.evidencias.totalQuestoesNoEscopo, 10);
    assert.ok(baseline.leitura.hipoteseDiagnostica.length > 0);
  });

  it("exemplo narrativaInicioJson", () => {
    const snap = snapshotParsed();
    const foco = selecionarFocoInicialDoDiagnostico(snap);
    const narrativa = montarNarrativaInicioCiclo(snap, foco);

    assert.equal(narrativa.titulo, "Semana 1 da Jornada");
    assert.ok(narrativa.mensagem.includes("Semana 1"));
    assert.ok(narrativa.limiteDaSemana.includes("mini-quiz"));
    assert.ok(narrativa.limiteDaSemana.includes("etapa posterior"));
  });
});

describe("idempotência do ciclo", () => {
  it("3/4/5/6/7. resolverAcaoCicloInicial — retorna ativo ou índice 1 sem criar", () => {
    assert.equal(
      resolverAcaoCicloInicial({
        temSnapshotInicial: true,
        cicloAtivoId: "ciclo-ativo",
        cicloIndice1Id: null,
      }),
      "retornar_ativo"
    );
    assert.equal(
      resolverAcaoCicloInicial({
        temSnapshotInicial: true,
        cicloAtivoId: null,
        cicloIndice1Id: "ciclo-1",
      }),
      "retornar_indice1"
    );
    assert.equal(
      resolverAcaoCicloInicial({
        temSnapshotInicial: true,
        cicloAtivoId: null,
        cicloIndice1Id: null,
      }),
      "criar"
    );
  });

  it("6. ciclo criado tem indice = 1 (contrato persistirPrimeiroCiclo)", () => {
    const src = readFileSync(join(ROOT, "lib/jornada-ciclo-inicial.ts"), "utf8");
    assert.ok(src.includes("indice: 1"));
    assert.ok(src.includes('status: "ATIVO"'));
  });
});

describe("ausência de plano, quests e mini-quiz", () => {
  it("11. não cria StudyPlan", () => {
    const src = readFileSync(join(ROOT, "lib/jornada-ciclo-inicial.ts"), "utf8");
    assert.equal(src.includes("studyPlan.create"), false);
    assert.equal(src.includes("prisma.studyPlan"), false);
  });

  it("12. não cria Quest", () => {
    const src = readFileSync(join(ROOT, "lib/jornada-ciclo-inicial.ts"), "utf8");
    assert.equal(src.includes("quest.create"), false);
    assert.equal(src.includes("prisma.quest"), false);
  });

  it("13. não cria CicloQuiz / mini-quiz", () => {
    const src = readFileSync(join(ROOT, "lib/jornada-ciclo-inicial.ts"), "utf8");
    assert.equal(src.includes("cicloQuiz.create"), false);
    assert.equal(src.includes("prisma.cicloQuiz"), false);
  });

  it("não chama funções legadas de plano", () => {
    const src = readFileSync(join(ROOT, "lib/jornada-ciclo-inicial.ts"), "utf8");
    assert.equal(src.includes("aplicarPlanoEQuests"), false);
    assert.equal(src.includes("regenerarPlanoGlobalUsuario"), false);
    const elig = readFileSync(join(ROOT, "lib/jornada-elegibilidade.ts"), "utf8");
    assert.ok(elig.includes("podeGerarPlanoJornada"));
    assert.ok(elig.includes("return false"));
  });
});

describe("contrato da API e UI", () => {
  it("14. API /api/jornada/iniciar retorna cicloInicialId", () => {
    const route = readFileSync(join(ROOT, "app/api/jornada/iniciar/route.ts"), "utf8");
    assert.ok(route.includes("cicloInicialId"));
    const diag = readFileSync(join(ROOT, "lib/jornada-diagnostico-inicial.ts"), "utf8");
    assert.ok(diag.includes("cicloInicialId"));
  });

  it("15. UI mostra Semana 1 sem quests/plano detalhado", () => {
    const card = readFileSync(join(ROOT, "components/jornada-ciclo-inicial-card.tsx"), "utf8");
    const home = readFileSync(join(ROOT, "components/dashboard-home-copiloto.tsx"), "utf8");
    assert.ok(card.includes("JornadaCicloInicialCard"));
    assert.ok(card.includes("limiteDaSemana"));
    assert.equal(card.includes("/quests"), false);
    assert.equal(card.includes("Ver plano"), false);
    assert.ok(home.includes("JornadaCicloInicialCard"));
    assert.ok(home.includes("insight.cicloInicial"));
  });
});
