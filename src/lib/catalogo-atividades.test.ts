import { describe, expect, it } from "vitest";
import { montarCatalogoAtividades } from "./catalogo-atividades";

describe("montarCatalogoAtividades", () => {
  it("une dia 1 e dia 2 em um card quando ambos têm registro", () => {
    const d1 = {
      id: "p1",
      nome: "SIMULADO ENEM — 2026 — Dia 1 — HEXAG 06/06",
      banca: "SIMULADO ENEM",
      ano: 2026,
      dia: 1,
      tipo: "SIMULADO" as const,
      totalQuestoes: 90,
      caderno: "HEXAG 06/06",
    };
    const d2 = {
      id: "p2",
      nome: "SIMULADO ENEM — 2026 — Dia 2 — HEXAG 13/06",
      banca: "SIMULADO ENEM",
      ano: 2026,
      dia: 2,
      tipo: "SIMULADO" as const,
      totalQuestoes: 90,
      caderno: "HEXAG 13/06",
    };
    const outra = {
      id: "p3",
      nome: "UNESP 2026",
      banca: "UNESP",
      ano: 2026,
      dia: null,
      tipo: "VESTIBULAR" as const,
      totalQuestoes: 72,
      caderno: null,
    };

    const exams = [
      {
        id: "e2",
        provaId: "p2",
        data: new Date("2026-06-13"),
        questionAttempts: Array.from({ length: 90 }, (_, i) => ({
          numero: 91 + i,
          correto: i % 2 === 0,
        })),
      },
      {
        id: "e1",
        provaId: "p1",
        data: new Date("2026-06-06"),
        questionAttempts: Array.from({ length: 90 }, (_, i) => ({
          numero: i + 1,
          correto: i % 3 === 0,
        })),
      },
      {
        id: "e3",
        provaId: "p3",
        data: new Date("2026-05-01"),
        questionAttempts: [{ numero: 1, correto: true }],
      },
    ];

    const itens = montarCatalogoAtividades([d1, d2, outra], exams);
    const conjuntos = itens.filter((i) => i.kind === "conjunto");
    const singles = itens.filter((i) => i.kind === "single");

    expect(conjuntos).toHaveLength(1);
    expect(conjuntos[0]!.nome).toContain("180");
    expect(singles).toHaveLength(1);
    expect(singles[0]!.id).toBe("p3");
    expect(conjuntos[0]!.ultimaTentativa.totalQuestoes).toBe(180);
  });

  it("mantém dias separados se falta registro de um deles", () => {
    const d1 = {
      id: "p1",
      nome: "ENEM — 2026 — Dia 1",
      banca: "ENEM",
      ano: 2026,
      dia: 1,
      tipo: "SIMULADO" as const,
      totalQuestoes: 90,
      caderno: null,
    };
    const d2 = {
      id: "p2",
      nome: "ENEM — 2026 — Dia 2",
      banca: "ENEM",
      ano: 2026,
      dia: 2,
      tipo: "SIMULADO" as const,
      totalQuestoes: 90,
      caderno: null,
    };

    const itens = montarCatalogoAtividades([d1, d2], [
      {
        id: "e1",
        provaId: "p1",
        data: new Date(),
        questionAttempts: [{ numero: 1, correto: true }],
      },
    ]);

    expect(itens.filter((i) => i.kind === "conjunto")).toHaveLength(0);
    expect(itens.filter((i) => i.kind === "single")).toHaveLength(2);
  });
});
