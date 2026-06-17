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

  it("une SIMULADO ENEM HEXAG com datas diferentes no caderno", () => {
    const d1 = {
      id: "p1",
      banca: "SIMULADO ENEM",
      ano: 2026,
      dia: 1,
      tipo: "SIMULADO" as const,
      totalQuestoes: 90,
      caderno: "HEXAG 06/06",
      nome: "SIMULADO ENEM — 2026 — Dia 1 — HEXAG 06/06",
    };
    const d2 = {
      id: "p2",
      banca: "SIMULADO ENEM",
      ano: 2026,
      dia: 2,
      tipo: "SIMULADO" as const,
      totalQuestoes: 90,
      caderno: "HEXAG 13/06",
      nome: "SIMULADO ENEM — 2026 — Dia 2 — HEXAG 13/06",
    };
    const exams = [
      {
        id: "e2",
        data: new Date("2026-06-13"),
        modoUso: "OFICIAL" as const,
        banca: "SIMULADO ENEM",
        nome: d2.nome,
        provaId: d2.id,
        prova: d2,
        questionAttempts: [91, 100].map((numero) => ({ numero, correto: true })),
      },
      {
        id: "e1",
        data: new Date("2026-06-06"),
        modoUso: "OFICIAL" as const,
        banca: "SIMULADO ENEM",
        nome: d1.nome,
        provaId: d1.id,
        prova: d1,
        questionAttempts: [1, 10].map((numero) => ({ numero, correto: true })),
      },
    ];
    const unidades = agruparUnidadesJornada(exams);
    expect(unidades).toHaveLength(1);
    expect(unidades[0]!.conjuntoMultidia).toBe(true);
    expect(unidades[0]!.nome).toContain("HEXAG");
    expect(unidades[0]!.nome).toContain("180");
  });
});
