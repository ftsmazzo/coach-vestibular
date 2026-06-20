import { describe, expect, it } from "vitest";
import {
  compararQuestoesPorNumeroEOrdem,
  inferirOrdemIdiomasDoPdf,
  materiaParaVarianteIdioma,
  ordemVariantesFaixa,
} from "./prova-idioma";

describe("prova-idioma EN/ES", () => {
  it("ordemVariantesFaixa respeita espanhol primeiro", () => {
    expect(ordemVariantesFaixa("ESPANHOL_PRIMEIRO")).toEqual(["ESPANHOL", "INGLES"]);
    expect(ordemVariantesFaixa("INGLES_PRIMEIRO")).toEqual(["INGLES", "ESPANHOL"]);
  });

  it("compararQuestoesPorNumeroEOrdem ordena ES antes EN quando configurado", () => {
    const rows = [
      { numero: 1, idiomaVariante: "INGLES" },
      { numero: 1, idiomaVariante: "ESPANHOL" },
      { numero: 2, idiomaVariante: "COMUM" },
    ];
    const ordenado = [...rows].sort((a, b) =>
      compararQuestoesPorNumeroEOrdem(a, b, "ESPANHOL_PRIMEIRO")
    );
    expect(ordenado.map((r) => r.idiomaVariante)).toEqual(["ESPANHOL", "INGLES", "COMUM"]);
  });

  it("materiaParaVarianteIdioma reconhece Inglês e Espanhol", () => {
    expect(materiaParaVarianteIdioma("Inglês")).toBe("INGLES");
    expect(materiaParaVarianteIdioma("Espanhol")).toBe("ESPANHOL");
    expect(materiaParaVarianteIdioma("História")).toBeNull();
  });

  it("inferirOrdemIdiomasDoPdf detecta espanhol antes do inglês", () => {
    const ordem = inferirOrdemIdiomasDoPdf({
      idiomas_estrangeiros: "duplicata_ingles_espanhol",
      blocos: [
        { titulo: "Língua Espanhola", questao_inicio: 1, questao_fim: 5 },
        { titulo: "Língua Inglesa", questao_inicio: 1, questao_fim: 5 },
      ],
    });
    expect(ordem).toBe("ESPANHOL_PRIMEIRO");
  });
});
