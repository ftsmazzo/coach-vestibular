import { describe, expect, it } from "vitest";
import {
  faixaIdiomaProva,
  faixaIdiomaHeuristicaBanca,
  inferirFaixaIdiomaDoPdf,
  inferirFaixaEnEsConfiavel,
  inferirFaixaPorNumerosDuplicados,
  inferirFaixaPorVariantesEnEs,
  questaoPorNumeroETentativa,
  questoesParaTentativa,
  resolverFaixaIdiomaDualDeQuestoes,
  varianteParaNumero,
} from "./prova-idioma";

describe("prova-idioma", () => {
  const meta = {
    politicaIdiomas: "DUPLICATA_EN_ES" as const,
    idiomaQuestaoInicio: 1,
    idiomaQuestaoFim: 5,
  };

  const questoes = [
    { id: "1en", numero: 1, idiomaVariante: "INGLES", materia: "Inglês", assunto: "A", gabarito: "C" },
    { id: "1es", numero: 1, idiomaVariante: "ESPANHOL", materia: "Espanhol", assunto: "B", gabarito: "B" },
    { id: "6", numero: 6, idiomaVariante: "COMUM", materia: "História", assunto: "C", gabarito: "A" },
  ] as const;

  it("varianteParaNumero usa trilha do aluno na faixa", () => {
    expect(varianteParaNumero(1, meta, "ESPANHOL")).toBe("ESPANHOL");
    expect(varianteParaNumero(6, meta, "ESPANHOL")).toBe("COMUM");
  });

  it("questoesParaTentativa retorna uma linha por número lógico", () => {
    const efetivas = questoesParaTentativa([...questoes], meta, "ESPANHOL");
    expect(efetivas.map((q) => q.id)).toEqual(["1es", "6"]);
  });

  it("questaoPorNumeroETentativa resolve gabarito certo", () => {
    const q = questaoPorNumeroETentativa([...questoes], 1, meta, "INGLES");
    expect(q?.gabarito).toBe("C");
  });

  it("inferirFaixaIdiomaDoPdf lê blocos EN/ES ENEM", () => {
    const faixa = inferirFaixaIdiomaDoPdf({
      idiomas_estrangeiros: "duplicata_ingles_espanhol",
      blocos: [
        { titulo: "Língua Inglesa", questao_inicio: 1, questao_fim: 5 },
        { titulo: "Língua Espanhola", questao_inicio: 1, questao_fim: 5 },
      ],
    });
    expect(faixa).toEqual({ inicio: 1, fim: 5 });
  });

  it("inferirFaixaIdiomaDoPdf UFU: PT 1–15 depois EN/ES 16–20", () => {
    const faixa = inferirFaixaIdiomaDoPdf(
      {
        idiomas_estrangeiros: "duplicata_ingles_espanhol",
        total_questoes_detectado: 20,
        numeros: Array.from({ length: 20 }, (_, i) => i + 1),
        blocos: [
          { titulo: "Língua Portuguesa", questao_inicio: 1, questao_fim: 15 },
          { titulo: "Língua Inglesa", questao_inicio: 1, questao_fim: 20 },
          { titulo: "Língua Espanhola", questao_inicio: 1, questao_fim: 20 },
        ],
      },
      { banca: "UFU", totalEsperado: 20 }
    );
    expect(faixa).toEqual({ inicio: 16, fim: 20 });
  });

  it("faixaIdiomaHeuristicaBanca UFU 20 questões", () => {
    expect(faixaIdiomaHeuristicaBanca("UFU", 20)).toEqual({ inicio: 16, fim: 20 });
  });

  it("inferirFaixaIdiomaDoPdf fallback ENEM 45 questões", () => {
    const faixa = inferirFaixaIdiomaDoPdf({
      idiomas_estrangeiros: "duplicata_ingles_espanhol",
      total_questoes_detectado: 45,
      numeros: Array.from({ length: 45 }, (_, i) => i + 1),
      blocos: [],
    });
    expect(faixa).toEqual({ inicio: 1, fim: 5 });
  });

  it("faixaIdiomaProva null sem política", () => {
    expect(faixaIdiomaProva({ politicaIdiomas: "NENHUMA" })).toBeNull();
  });

  it("faixaIdiomaProva null sem início/fim explícitos (evita gabarito travado)", () => {
    expect(
      faixaIdiomaProva({ politicaIdiomas: "DUPLICATA_EN_ES" })
    ).toBeNull();
    expect(
      faixaIdiomaProva({
        politicaIdiomas: "DUPLICATA_EN_ES",
        idiomaQuestaoInicio: 16,
        idiomaQuestaoFim: 20,
      })
    ).toEqual({ inicio: 16, fim: 20 });
  });

  it("inferirFaixaPorNumerosDuplicados detecta faixa EN/ES por linhas repetidas", () => {
    const questoes = [
      ...Array.from({ length: 15 }, (_, i) => ({ numero: i + 1 })),
      { numero: 16 },
      { numero: 16 },
      { numero: 17 },
      { numero: 17 },
      { numero: 18 },
      { numero: 18 },
      { numero: 19 },
      { numero: 19 },
      { numero: 20 },
      { numero: 20 },
    ];
    expect(inferirFaixaPorNumerosDuplicados(questoes)).toEqual({ inicio: 16, fim: 20 });
  });

  it("inferirFaixaEnEsConfiavel exige bloco contíguo e total físico = lógico + faixa", () => {
    const base = Array.from({ length: 82 }, (_, i) => ({ numero: i + 1 }));
    const faixa = Array.from({ length: 8 }, (_, i) => i + 83).flatMap((n) => [
      { numero: n },
      { numero: n },
    ]);
    expect(inferirFaixaEnEsConfiavel([...base, ...faixa], 90)).toEqual({ inicio: 83, fim: 90 });
    expect(inferirFaixaEnEsConfiavel(base, 90)).toBeNull();
  });

  it("inferirFaixaEnEsConfiavel rejeita duplicatas esparsas (evita 45 faltantes)", () => {
    const questoes = Array.from({ length: 90 }, (_, i) => ({ numero: i + 1 }));
    for (let n = 46; n <= 90; n++) {
      questoes.push({ numero: n });
    }
    expect(inferirFaixaEnEsConfiavel(questoes, 90)).toBeNull();
  });

  it("inferirFaixaPorVariantesEnEs rejeita pares esparsos (dois blocos)", () => {
    const questoes = [
      ...Array.from({ length: 4 }, (_, i) => [
        { numero: 36 + i, idiomaVariante: "INGLES" as const },
        { numero: 36 + i, idiomaVariante: "ESPANHOL" as const },
      ]).flat(),
      ...Array.from({ length: 4 }, (_, i) => [
        { numero: 62 + i, idiomaVariante: "INGLES" as const },
        { numero: 62 + i, idiomaVariante: "ESPANHOL" as const },
      ]).flat(),
    ];
    expect(inferirFaixaPorVariantesEnEs(questoes)).toBeNull();
  });

  it("inferirFaixaPorVariantesEnEs aceita bloco contíguo de pares", () => {
    const questoes = Array.from({ length: 5 }, (_, i) => [
      { numero: i + 1, idiomaVariante: "INGLES" as const },
      { numero: i + 1, idiomaVariante: "ESPANHOL" as const },
    ]).flat();
    expect(inferirFaixaPorVariantesEnEs(questoes)).toEqual({ inicio: 1, fim: 5 });
  });

  it("resolverFaixaIdiomaDualDeQuestoes prioriza cadastro e duplicata física confiável", () => {
    const meta = {
      politicaIdiomas: "DUPLICATA_EN_ES" as const,
      idiomaQuestaoInicio: 16,
      idiomaQuestaoFim: 20,
    };
    expect(
      resolverFaixaIdiomaDualDeQuestoes([{ numero: 1 }, { numero: 16 }, { numero: 16 }], meta, 20)
    ).toEqual({ inicio: 16, fim: 20 });

    const base = Array.from({ length: 82 }, (_, i) => ({ numero: i + 1 }));
    const faixa = Array.from({ length: 8 }, (_, i) => i + 83).flatMap((n) => [
      { numero: n },
      { numero: n },
    ]);
    expect(resolverFaixaIdiomaDualDeQuestoes([...base, ...faixa], undefined, 90)).toEqual({
      inicio: 83,
      fim: 90,
    });

    expect(
      resolverFaixaIdiomaDualDeQuestoes([
        { numero: 16, idiomaVariante: "INGLES" },
        { numero: 16, idiomaVariante: "ESPANHOL" },
      ])
    ).toEqual({ inicio: 16, fim: 16 });
  });
});
