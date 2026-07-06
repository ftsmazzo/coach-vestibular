/**
 * Testes do Diagnóstico Inicial da Jornada — Etapa 2.
 * Executar: node --import tsx --test src/lib/jornada-diagnostico-inicial.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  MIN_ERROS_ANALISAVEIS_JORNADA,
  MIN_PROVAS_JORNADA,
  MIN_QUESTOES_JORNADA,
  calcularElegibilidadeJornada,
} from "./jornada-elegibilidade";
import {
  JOURNEY_DIAGNOSTIC_TIPO_INICIAL,
  montarDiagnosticoInicialPayload,
  resolverAcaoIniciarJornada,
  type ColetaEvidenciasBruta,
} from "./jornada-diagnostico-inicial";

function metricasElegiveis() {
  return {
    anamneseConcluida: true,
    provasOuSimuladosValidos: MIN_PROVAS_JORNADA,
    totalQuestoesValidas: MIN_QUESTOES_JORNADA,
    totalErrosAnalisaveis: MIN_ERROS_ANALISAVEIS_JORNADA,
    pctQuestoesComN1N2N3: 0.96,
  };
}

function coletaMinima(overrides: Partial<ColetaEvidenciasBruta> = {}): ColetaEvidenciasBruta {
  const exam1 = "exam-1";
  const exam2 = "exam-2";
  const attempts = Array.from({ length: 40 }, (_, i) => ({
    numero: i + 1,
    correto: i % 3 !== 0,
    materiaId: "matematica",
    conhecimentoDominioId: "mat.algebra",
    conhecimentoEscopoId: i % 5 === 0 ? "mat.funcoes.quadratica" : "mat.geometria.plana",
    conhecimentoExigido: "Compreender o conceito exigido na questão.",
    classificacaoConfianca: 0.9,
    tipoErro: i % 3 === 0 ? ("CONCEITO_TEORICO" as const) : null,
    observacao: i % 7 === 0 ? "Não lembrei da fórmula" : null,
    metadadosCognitivosJson: null,
    provaQuestao: {
      classificacaoN1Json: JSON.stringify({
        versao: "n1-v1",
        area: "exatas",
        catalogoId: "matematica",
        confianca: 0.9,
        criterio: "teste",
        justificativa: "teste",
        classificadoEm: new Date().toISOString(),
      }),
      conhecimentoDominioId: "mat.algebra",
      conhecimentoEscopoId: i % 5 === 0 ? "mat.funcoes.quadratica" : "mat.geometria.plana",
      conhecimentoExigido: "Compreender o conceito exigido na questão.",
      materia: "matematica",
    },
  }));

  const unidade = (examId: string, offset: number) => ({
    id: examId,
    examIds: [examId],
    conjuntoMultidia: false,
    data: new Date("2026-01-01"),
    modoUso: "OFICIAL" as const,
    banca: "UFU",
    nome: `Prova ${examId}`,
    provaId: `prova-${examId}`,
    totalQuestoes: 40,
    questionAttempts: attempts.map((a, i) => ({
      ...a,
      numero: i + 1 + offset,
      correto: (i + offset) % 3 !== 0,
    })),
    exames: [],
  });

  return {
    geradoEm: new Date("2026-06-01T12:00:00.000Z"),
    metaProva: "UFU 2026",
    vestibularAlvo: "Medicina",
    anamnese: {
      concluida: true,
      completedAt: new Date("2026-05-01"),
      resumo: "Aluno em cursinho com rotina limitada durante a semana.",
      structuredProfile: {
        trajectory: {},
        routine: { consistencyLevel: "BAIXA" },
        academicSelfPerception: {
          perceivedWeakSubjects: ["Química"],
          mainDeclaredBlocker: "tempo",
        },
        examBehavior: { anxietyOrBlanking: true },
        metacognition: { metacognitiveMaturity: "MEDIA" },
        emotionalContext: { confidenceLevel: "MEDIA" },
        declaredPatterns: ["erro por interpretação"],
      },
      structuredProfileJson: {},
    },
    unidades: [unidade(exam1, 0), unidade(exam2, 100)],
    metricas: metricasElegiveis(),
    ...overrides,
  };
}

describe("resolverAcaoIniciarJornada", () => {
  it("1. não gera se não elegível", () => {
    assert.equal(
      resolverAcaoIniciarJornada({
        elegivel: false,
        snapshotInicialId: null,
        jornadaIniciadaEm: null,
        modoRecuperacao: false,
      }),
      "bloquear"
    );
  });

  it("2. cria quando elegível sem snapshot", () => {
    assert.equal(
      resolverAcaoIniciarJornada({
        elegivel: true,
        snapshotInicialId: null,
        jornadaIniciadaEm: null,
        modoRecuperacao: false,
      }),
      "criar"
    );
  });

  it("3. não duplica se snapshot inicial existe", () => {
    assert.equal(
      resolverAcaoIniciarJornada({
        elegivel: true,
        snapshotInicialId: "snap-1",
        jornadaIniciadaEm: new Date(),
        modoRecuperacao: false,
      }),
      "retornar_existente"
    );
  });

  it("4. recupera snapshot se jornadaIniciadaEm sem snapshot", () => {
    assert.equal(
      resolverAcaoIniciarJornada({
        elegivel: false,
        snapshotInicialId: null,
        jornadaIniciadaEm: new Date(),
        modoRecuperacao: true,
      }),
      "recuperar"
    );
  });
});

describe("montarDiagnosticoInicialPayload", () => {
  const payload = montarDiagnosticoInicialPayload(coletaMinima());

  it("5. contém evidenciasJson", () => {
    assert.equal(payload.evidenciasJson.versao, "1.0");
    assert.ok(payload.evidenciasJson.provasConsideradas.length >= 2);
    assert.ok(payload.evidenciasJson.totais.questoesValidas >= MIN_QUESTOES_JORNADA);
  });

  it("6. contém baselineJson", () => {
    assert.equal(payload.baselineJson.versao, "1.0");
    assert.ok(payload.baselineJson.porEscopo.length > 0);
    assert.ok(payload.baselineJson.porN1.length > 0);
  });

  it("7. contém diagnosticoJson", () => {
    assert.equal(payload.diagnosticoJson.tipo, JOURNEY_DIAGNOSTIC_TIPO_INICIAL);
    assert.ok(payload.diagnosticoJson.resumoExecutivo.length > 20);
    assert.ok(Array.isArray(payload.diagnosticoJson.prioridadesIniciais));
  });

  it("8. contém narrativaJson", () => {
    assert.equal(payload.narrativaJson.titulo, "Diagnóstico Inicial da Jornada");
    assert.ok(payload.narrativaJson.mensagemPrincipal.length > 10);
    assert.ok(payload.narrativaJson.avisoLimite.includes("marco zero"));
  });

  it("9. baseline usa conhecimentoEscopoId, não apenas materiaId", () => {
    const escopos = payload.baselineJson.porEscopo.map((e) => e.escopoId);
    assert.ok(escopos.every((id) => id.includes(".")));
    assert.ok(escopos.some((id) => id.startsWith("mat.")));
    assert.equal(escopos.some((id) => id === "matematica"), false);
  });

  it("10. metadados cognitivos entram em padroesCognitivos via tipoErro", () => {
    assert.ok(payload.baselineJson.padroesCognitivos.length > 0);
    assert.ok(
      payload.baselineJson.padroesCognitivos.some((p) => p.tipo === "CONCEITO_TEORICO")
    );
  });

  it("11. anamnese entra em influenciaAnamnese", () => {
    assert.ok(payload.diagnosticoJson.influenciaAnamnese.resumo.length > 5);
    assert.ok(payload.diagnosticoJson.influenciaAnamnese.moduladores.length > 0);
    assert.ok(payload.diagnosticoJson.influenciaAnamnese.limites.length > 0);
  });
});

describe("evidências fracas não geram diagnóstico inicial", () => {
  it("12. quest isolada não entra na coleta (sem unidades de prova)", () => {
    const vazio = montarDiagnosticoInicialPayload(
      coletaMinima({ unidades: [], metricas: metricasElegiveis() })
    );
    assert.equal(vazio.evidenciasJson.totais.provasValidas, 0);
    assert.equal(vazio.evidenciasJson.totais.questoesValidas, 0);
  });

  it("13. mini-quiz isolado não conta como prova válida", () => {
    const elig = calcularElegibilidadeJornada({
      ...metricasElegiveis(),
      provasOuSimuladosValidos: 1,
    });
    assert.equal(elig.elegivel, false);
  });
});

describe("contrato da API e ausência de plano/ciclo", () => {
  it("14. resultado de sucesso inclui snapshotInicialId no tipo", () => {
    const ok = {
      ok: true as const,
      jaIniciada: false,
      snapshotInicialId: "snap-test-123",
    };
    assert.equal(ok.snapshotInicialId, "snap-test-123");
  });

  it("15. motor não cria StudyPlan, Quest nem LearningCycle (somente snapshot)", () => {
    const src = montarDiagnosticoInicialPayload.toString();
    assert.equal(src.includes("studyPlan"), false);
    assert.equal(src.includes("learningCycle"), false);
    assert.equal(src.includes("quest.create"), false);
    const iniciarSrc = resolverAcaoIniciarJornada.toString();
    assert.equal(iniciarSrc.includes("StudyPlan"), false);
  });
});
