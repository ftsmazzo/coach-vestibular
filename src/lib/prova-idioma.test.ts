import { describe, expect, it } from "vitest";
import {
  faixaIdiomaProva,
  inferirFaixaIdiomaDoPdf,
  questaoPorNumeroETentativa,
  questoesParaTentativa,
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

  it("inferirFaixaIdiomaDoPdf lê blocos EN/ES", () => {
    const faixa = inferirFaixaIdiomaDoPdf({
      idiomas_estrangeiros: "duplicata_ingles_espanhol",
      blocos: [
        { titulo: "Língua Inglesa", questao_inicio: 1, questao_fim: 5 },
        { titulo: "Língua Espanhola", questao_inicio: 1, questao_fim: 5 },
      ],
    });
    expect(faixa).toEqual({ inicio: 1, fim: 5 });
  });

  it("faixaIdiomaProva null sem política", () => {
    expect(faixaIdiomaProva({ politicaIdiomas: "NENHUMA" })).toBeNull();
  });
});
