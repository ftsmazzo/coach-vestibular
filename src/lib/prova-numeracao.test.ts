import { describe, expect, it } from "vitest";
import {
  normalizarMapaGabarito,
  normalizarNumerosGabaritoExtraido,
  resolverNumerosGradeProva,
} from "./prova-numeracao";

describe("resolverNumerosGradeProva", () => {
  it("usa 91–180 quando questões cadastradas começam em 91", () => {
    const nums = resolverNumerosGradeProva({
      totalQuestoes: 90,
      banca: "ENEM",
      dia: 2,
      numerosCadastrados: [91, 92, 180],
    });
    expect(nums[0]).toBe(91);
    expect(nums[nums.length - 1]).toBe(180);
    expect(nums.length).toBe(90);
  });

  it("infere 91–180 pelo dia 2 ENEM sem cadastro", () => {
    const nums = resolverNumerosGradeProva({
      totalQuestoes: 90,
      banca: "ENEM",
      dia: 2,
    });
    expect(nums).toEqual([91, ...Array.from({ length: 88 }, (_, i) => 92 + i), 180]);
  });

  it("mantém 1–90 para dia 1", () => {
    const nums = resolverNumerosGradeProva({
      totalQuestoes: 90,
      banca: "ENEM",
      dia: 1,
    });
    expect(nums[0]).toBe(1);
    expect(nums[89]).toBe(90);
  });
});

describe("normalizarNumerosGabaritoExtraido", () => {
  it("desloca 1–90 para 91–180", () => {
    const respostas = [
      { numero: 1, letra: "A" },
      { numero: 2, letra: "B" },
    ];
    const esperados = Array.from({ length: 90 }, (_, i) => 91 + i);
    const { respostas: out, deslocamento } = normalizarNumerosGabaritoExtraido(
      respostas,
      esperados
    );
    expect(deslocamento).toBe(90);
    expect(out[0]?.numero).toBe(91);
    expect(out[1]?.numero).toBe(92);
  });
});

describe("normalizarMapaGabarito", () => {
  it("ajusta mapa colado 1,C para questão 91", () => {
    const mapa = new Map([[1, "C"]]);
    const esperados = Array.from({ length: 90 }, (_, i) => 91 + i);
    const out = normalizarMapaGabarito(mapa, esperados);
    expect(out.get(91)).toBe("C");
  });
});
