import { describe, expect, it } from "vitest";
import { agruparUnidadesJornada, normalizarNumeroMultidia } from "./prova-multidia";

const provaD1 = {
  id: "p1",
  banca: "ENEM",
  ano: 2024,
  dia: 1,
  tipo: "PROVA_OFICIAL" as const,
  totalQuestoes: 90,
  caderno: null,
};

const provaD2 = {
  id: "p2",
  banca: "ENEM",
  ano: 2024,
  dia: 2,
  tipo: "PROVA_OFICIAL" as const,
  totalQuestoes: 90,
  caderno: null,
};

function mkExam(
  id: string,
  prova: typeof provaD1,
  data: string,
  numeros: number[]
) {
  return {
    id,
    data: new Date(data),
    modoUso: "OFICIAL" as const,
    banca: "ENEM",
    nome: `ENEM 2024 Dia ${prova.dia}`,
    provaId: prova.id,
    prova,
    questionAttempts: numeros.map((numero) => ({ numero, correto: numero % 2 === 0 })),
  };
}

describe("agruparUnidadesJornada", () => {
  it("une dia 1 e dia 2 em 180 questões", () => {
    const exams = [
      mkExam("e2", provaD2, "2024-11-10", [91, 92, 180]),
      mkExam("e1", provaD1, "2024-11-09", [1, 2, 90]),
    ];
    const unidades = agruparUnidadesJornada(exams);
    expect(unidades).toHaveLength(1);
    expect(unidades[0]!.conjuntoMultidia).toBe(true);
    expect(unidades[0]!.questionAttempts).toHaveLength(6);
    expect(unidades[0]!.totalQuestoes).toBe(180);
    expect(unidades[0]!.nome).toContain("180");
  });

  it("mantém dia isolado se falta o par", () => {
    const exams = [mkExam("e1", provaD1, "2024-11-09", [1, 2])];
    const unidades = agruparUnidadesJornada(exams);
    expect(unidades).toHaveLength(1);
    expect(unidades[0]!.conjuntoMultidia).toBe(false);
  });

  it("normaliza dia 2 lido como 1–90", () => {
    expect(normalizarNumeroMultidia(1, provaD2)).toBe(91);
    expect(normalizarNumeroMultidia(90, provaD2)).toBe(180);
  });

  it("une ENEM sem campo dia mas com numeração 91–180", () => {
    const semDia1 = { ...provaD1, dia: null, nome: "ENEM 2024" };
    const semDia2 = { ...provaD2, dia: null, nome: "ENEM 2024" };
    const exams = [
      mkExam("e2", semDia2 as typeof provaD1, "2024-11-10", [91, 100]),
      mkExam("e1", semDia1 as typeof provaD1, "2024-11-09", [1, 10]),
    ];
    const unidades = agruparUnidadesJornada(exams);
    expect(unidades).toHaveLength(1);
    expect(unidades[0]!.conjuntoMultidia).toBe(true);
  });

  it("une ENEM com cadernos diferentes (azul/amarelo)", () => {
    const azul = { ...provaD1, caderno: "Azul" };
    const amarelo = { ...provaD2, caderno: "Amarelo" };
    const exams = [
      mkExam("e2", amarelo, "2024-11-10", [91, 92]),
      mkExam("e1", azul, "2024-11-09", [1, 2]),
    ];
    expect(agruparUnidadesJornada(exams)).toHaveLength(1);
  });
});
