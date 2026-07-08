/**
 * Etapa 4E-A — testes da evidência canônica da Jornada.
 * Executar: node --import tsx --test src/lib/jornada-evidencia-canonica.test.ts
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  agregarEvidenciasCanonicas,
  formatarEvidenciaFocoAgregada,
  processarUnidadesEvidenciaCanonica,
  resolverQuestaoEvidenciaCanonica,
  type QuestaoEvidenciaCanonica,
} from "./jornada-evidencia-canonica";

const ESCOPO = "mat.geometria.soma_angulos";
const LABEL = "Soma de ângulos em figuras planas";

function n1Json() {
  return JSON.stringify({
    versao: "n1-v1",
    area: "exatas",
    catalogoId: "matematica",
    confianca: 0.9,
    criterio: "teste",
    justificativa: "teste",
    classificadoEm: new Date().toISOString(),
  });
}

function questao(
  examId: string,
  nome: string,
  numero: number,
  correto: boolean
): QuestaoEvidenciaCanonica {
  const q = resolverQuestaoEvidenciaCanonica(
    examId,
    examId,
    nome,
    "OFICIAL",
    {
      numero,
      correto,
      materiaId: "matematica",
      conhecimentoDominioId: "mat.geometria",
      conhecimentoEscopoId: ESCOPO,
      conhecimentoExigido: "Aplicar soma de ângulos em figuras planas",
      tipoErro: correto ? null : "CONCEITO_TEORICO",
      provaQuestao: {
        classificacaoN1Json: n1Json(),
        conhecimentoDominioId: "mat.geometria",
        conhecimentoEscopoId: ESCOPO,
        conhecimentoExigido: "Aplicar soma de ângulos em figuras planas",
        materia: "matematica",
      },
    },
    null
  );
  assert.ok(q);
  return q!;
}

describe("agregação canônica 2 + 1 erros", () => {
  const provaA = [
    questao("exam-a", "Simulado FAMERP", 12, false),
    questao("exam-a", "Simulado FAMERP", 28, false),
    questao("exam-a", "Simulado FAMERP", 40, true),
  ];
  const provaB = [questao("exam-b", "UNESP Meio Ano", 15, false)];

  const agregado = agregarEvidenciasCanonicas([...provaA, ...provaB]);
  const escopo = agregado.find((e) => e.escopoId === ESCOPO);

  it("agrega 2 erros + 1 erro = 3 erros no escopo", () => {
    assert.ok(escopo);
    assert.equal(escopo!.erros, 3);
    assert.equal(escopo!.total, 4);
    assert.equal(escopo!.provasComErro, 2);
  });

  it("mantém separação por prova", () => {
    assert.equal(escopo!.ocorrenciasPorProva.length, 2);
    const famerp = escopo!.ocorrenciasPorProva.find((o) => o.nome.includes("FAMERP"));
    const unesp = escopo!.ocorrenciasPorProva.find((o) => o.nome.includes("UNESP"));
    assert.equal(famerp?.erros, 2);
    assert.equal(unesp?.erros, 1);
    assert.deepEqual(famerp?.numerosErradas.sort(), [12, 28]);
    assert.deepEqual(unesp?.numerosErradas, [15]);
  });

  it("texto agregado deixa claro soma entre provas", () => {
    const texto = formatarEvidenciaFocoAgregada({
      escopoId: ESCOPO,
      label: LABEL,
      total: 4,
      acertos: 1,
      erros: 3,
      pctErro: 75,
      provasComErro: 2,
      provasComQuestao: 2,
      ocorrenciasPorProva: escopo!.ocorrenciasPorProva,
      n3Recorrentes: [],
      tiposErro: { CONCEITO_TEORICO: 3 },
    });
    assert.ok(texto.includes("somando as provas consideradas"));
    assert.ok(texto.includes("3 erro"));
    assert.ok(texto.includes("FAMERP"));
    assert.ok(texto.includes("UNESP"));
  });
});

describe("coerência porProva processada", () => {
  it("porProva mantém 2 erros na prova A", () => {
    const unidades = [
      {
        id: "exam-a",
        examIds: ["exam-a"],
        conjuntoMultidia: false,
        data: new Date(),
        modoUso: "OFICIAL" as const,
        banca: "FAMERP",
        nome: "Simulado FAMERP",
        provaId: "prova-a",
        totalQuestoes: 3,
        questionAttempts: [
          {
            numero: 12,
            correto: false,
            materiaId: "matematica",
            conhecimentoEscopoId: ESCOPO,
            conhecimentoExigido: "Aplicar soma de ângulos em figuras planas",
            tipoErro: "CONCEITO_TEORICO",
            provaQuestao: {
              classificacaoN1Json: n1Json(),
              conhecimentoEscopoId: ESCOPO,
              conhecimentoExigido: "Aplicar soma de ângulos em figuras planas",
              materia: "matematica",
            },
          },
          {
            numero: 28,
            correto: false,
            materiaId: "matematica",
            conhecimentoEscopoId: ESCOPO,
            conhecimentoExigido: "Aplicar soma de ângulos em figuras planas",
            tipoErro: "CONCEITO_TEORICO",
            provaQuestao: {
              classificacaoN1Json: n1Json(),
              conhecimentoEscopoId: ESCOPO,
              conhecimentoExigido: "Aplicar soma de ângulos em figuras planas",
              materia: "matematica",
            },
          },
        ],
        exames: [{ id: "exam-a", prova: { nome: "Simulado FAMERP", questoes: [] } }],
      },
    ];

    const resultado = processarUnidadesEvidenciaCanonica(unidades);
    const porProva = resultado.porProva[0]!;
    const escopoProva = porProva.porEscopo.find((e) => e.escopoId === ESCOPO)!;
    assert.equal(escopoProva.erros, 2);
    assert.equal(escopoProva.numerosErradas.sort().join(","), "12,28");
  });
});
