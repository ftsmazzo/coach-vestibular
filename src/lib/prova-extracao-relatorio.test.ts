import { describe, expect, it } from "vitest";
import { montarRelatorioExtracaoComCobertura } from "./prova-extracao-relatorio";
import { PLACEHOLDER_REVISAO_IMAGEM } from "./prova-revisao-imagem";

describe("prova-extracao-relatorio", () => {
  const provaBase = {
    totalQuestoes: 90,
    politicaIdiomas: "NENHUMA" as const,
    banca: "VUNESP",
  };

  function linha(ordem: number, numero: number, enunciado: string, alternativas?: string) {
    return {
      id: `q-${ordem}`,
      ordemExtracao: ordem,
      numero,
      enunciado,
      alternativas: alternativas ?? "A) x B) y C) z D) w E) v",
      idiomaVariante: "COMUM",
    };
  }

  it("bloqueia validação com texto incompleto nas alternativas", () => {
    const questoes = [
      linha(1, 1, "Enunciado longo o suficiente para passar na validação de caracteres mínimos exigidos."),
      {
        ...linha(2, 2, "Outro enunciado longo o suficiente para passar na validação de caracteres."),
        alternativas: PLACEHOLDER_REVISAO_IMAGEM,
      },
    ];
    const rel = montarRelatorioExtracaoComCobertura(questoes, provaBase);
    expect(rel.textoIncompleto).toBe(1);
    expect(rel.prontaParaValidar).toBe(false);
    expect(rel.bloqueiosValidacao.some((b) => b.includes("alternativas incompletas"))).toBe(true);
  });

  it("aceita quando enunciados ok e cobertura completa", () => {
    const en =
      "Enunciado longo o suficiente para passar na validação de caracteres mínimos exigidos no admin.";
    const questoes = Array.from({ length: 90 }, (_, i) => linha(i + 1, i + 1, en));
    const rel = montarRelatorioExtracaoComCobertura(questoes, provaBase);
    expect(rel.prontaParaValidar).toBe(true);
    expect(rel.coberturaFaltando).toBe(0);
  });
});
