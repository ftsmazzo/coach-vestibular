import { describe, expect, it } from "vitest";
import type { AttemptInput } from "@/lib/diagnosis";
import { buildEscopoScores, buildFocosPedagogicos } from "@/lib/diagnosis-escopo";
import { montarQuestEscopoDirigida } from "@/lib/learning-quest-escopo";
import { buscarEscoposPorTexto } from "@/lib/escopo-display";

describe("motor v1 — escopo N2", () => {
  it("buildFocosPedagogicos prioriza escopo com erros N2", () => {
    const attempts: AttemptInput[] = [
      {
        numero: 1,
        correto: false,
        conhecimentoEscopoId: "mat.funcoes.quadratica",
        tipoErro: "CONCEITO_TEORICO",
      },
      {
        numero: 2,
        correto: true,
        conhecimentoEscopoId: "mat.funcoes.quadratica",
      },
    ];

    const scores = buildEscopoScores(attempts, []);
    expect(scores.length).toBeGreaterThan(0);
    expect(scores[0]?.escopoId).toBeTruthy();

    const focos = buildFocosPedagogicos(scores, attempts);
    expect(focos.length).toBeGreaterThan(0);
    expect(focos[0]?.escopoId).toBe(scores[0]?.escopoId);
    expect(focos[0]?.estrategiaRecomendada).toBeTruthy();
  });

  it("montarQuestEscopoDirigida inclui conhecimentoEscopoId e estrategia", () => {
    const fp = buildFocosPedagogicos(
      buildEscopoScores(
        [
          {
            numero: 3,
            correto: false,
            conhecimentoEscopoId: "bio.celula.metabolismo",
            tipoErro: "INTERPRETACAO_ENUNCIADO",
          },
        ],
        []
      ),
      [
        {
          numero: 3,
          correto: false,
          conhecimentoEscopoId: "bio.celula.metabolismo",
          tipoErro: "INTERPRETACAO_ENUNCIADO",
        },
      ]
    )[0]!;

    const quest = montarQuestEscopoDirigida(fp, 1, "Prioridade", (tipo, id) => `${tipo}:${id}`);
    expect(quest.conhecimentoEscopoId).toBe(fp.escopoId);
    expect(quest.tipoQuest).toBe(fp.estrategiaRecomendada);
    expect(quest.chave).toContain("escopo:");
  });

  it("snapshot diagnóstico não contém campos cluster legados", () => {
    const snapshot = {
      overallAcerto: 0.6,
      escopoScores: [{ escopoId: "x", erros: 1 }],
      focosPedagogicos: [{ escopoId: "x", focoId: "x" }],
    };
    const json = JSON.stringify(snapshot);
    expect(json).not.toMatch(/clusterPrincipal|metaClusterId|materiaScores|temaScores/);
    expect(json).toContain("focosPedagogicos");
    expect(json).toContain("escopoScores");
  });

  it("buscarEscoposPorTexto retorna resultados do catálogo", () => {
    const hits = buscarEscoposPorTexto("fun");
    expect(Array.isArray(hits)).toBe(true);
  });
});
