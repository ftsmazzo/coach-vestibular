import { describe, expect, it } from "vitest";
import { statsQuestoesProva } from "./prova-stats";

describe("statsQuestoesProva", () => {
  it("ENEM dia 2 completo não lista faltantes 1–90", () => {
    const questoes = Array.from({ length: 90 }, (_, i) => ({ numero: 91 + i }));
    const stats = statsQuestoesProva(questoes, 90, { dia: 2, banca: "ENEM" });
    expect(stats.faltando).toEqual([]);
    expect(stats.incompleto).toBe(false);
    expect(stats.cadastradas).toBe(90);
  });

  it("detecta buraco na faixa 91–180", () => {
    const questoes = [{ numero: 91 }, { numero: 93 }];
    const stats = statsQuestoesProva(questoes, 90, { dia: 2, banca: "ENEM" });
    expect(stats.faltando).toContain(92);
    expect(stats.incompleto).toBe(true);
  });

  it("duplicata EN/ES exige duas variantes na faixa 1–5", () => {
    const questoes = [
      { numero: 1, idiomaVariante: "INGLES" },
      { numero: 6, idiomaVariante: "COMUM" },
    ];
    const stats = statsQuestoesProva(questoes, 60, {
      politicaIdiomas: "DUPLICATA_EN_ES",
      idiomaQuestaoInicio: 1,
      idiomaQuestaoFim: 5,
    });
    expect(stats.faltando).toContain(1);
    expect(stats.incompleto).toBe(true);
  });

  it("duplicata completa conta slots lógicos", () => {
    const questoes = [
      ...Array.from({ length: 5 }, (_, i) => [
        { numero: i + 1, idiomaVariante: "INGLES" as const },
        { numero: i + 1, idiomaVariante: "ESPANHOL" as const },
      ]).flat(),
      ...Array.from({ length: 55 }, (_, i) => ({ numero: i + 6, idiomaVariante: "COMUM" as const })),
    ];
    const stats = statsQuestoesProva(questoes, 60, {
      politicaIdiomas: "DUPLICATA_EN_ES",
      idiomaQuestaoInicio: 1,
      idiomaQuestaoFim: 5,
    });
    expect(stats.faltando).toEqual([]);
    expect(stats.incompleto).toBe(false);
    expect(stats.cadastradas).toBe(60);
    expect(stats.linhasBanco).toBe(65);
  });
});
