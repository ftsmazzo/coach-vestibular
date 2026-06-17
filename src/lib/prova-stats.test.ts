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
});
