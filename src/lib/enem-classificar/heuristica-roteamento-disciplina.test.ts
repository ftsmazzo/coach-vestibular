import { describe, expect, it } from "vitest";
import {
  aplicarRoteamentoDeterministicoLinguagens,
  heuristicaHumanasDisciplina,
  heuristicaLinguagensDisciplina,
  roteamentoLinguagensPorHeuristica,
} from "./heuristica-roteamento-disciplina";
import { triarMateriaNatureza } from "./triagem-natureza";

describe("heuristicaLinguagensDisciplina", () => {
  it("detecta equivalência de expressão inglesa com comando em português", () => {
    const texto =
      "No contexto da tira, a fala da menina no segundo quadrinho 'That'll be the day!' equivale, em português, a:";
    const r = heuristicaLinguagensDisciplina(texto);
    expect(r?.disciplinaId).toBe("ingles");
  });

  it("detecta inferência sobre trecho em inglês na tira", () => {
    const texto =
      "O trecho da tira que faz com que o argumento do menino seja invalidado é:\nDon't try to fool me";
    const r = heuristicaLinguagensDisciplina(texto);
    expect(r?.disciplinaId).toBe("ingles");
  });

  it("não força inglês em tirinha puramente em português", () => {
    const texto =
      "No contexto da tirinha em português, o efeito de humor decorre da relação entre imagem e fala dos personagens.";
    expect(heuristicaLinguagensDisciplina(texto)).toBeNull();
  });

  it("não converte rota indefinida em português", () => {
    const rota = aplicarRoteamentoDeterministicoLinguagens(
      "Texto curto sem sinal de língua estrangeira.",
      "COMUM",
      {
        disciplinaId: "indefinido",
        criterio: "incerto",
        confianca: 0,
        justificativa: "IA incerta",
        sinalizadorRevisao: true,
      }
    );
    expect(rota.disciplinaId).toBe("indefinido");
  });
});

describe("heuristicaHumanasDisciplina", () => {
  it("roteia exclusão social / produtivismo para sociologia", () => {
    const texto =
      "Com base no ensaio de Simone de Beauvoir, identifique como a sociedade reduz o valor do indivíduo à capacidade produtiva e promove exclusão social dos idosos.";
    expect(heuristicaHumanasDisciplina(texto)?.disciplinaId).toBe("sociologia");
  });

  it("roteia esgoto/eutrofização para geografia", () => {
    const texto =
      "O tratamento de esgoto reduz o lançamento de matéria orgânica nos corpos hídricos, prevenindo a eutrofização e a degradação da qualidade da água.";
    expect(heuristicaHumanasDisciplina(texto)?.disciplinaId).toBe("geografia");
  });
});

describe("triarMateriaNatureza com desempate", () => {
  it("prioriza biologia em sucessão ecológica", () => {
    const r = triarMateriaNatureza(
      "Após perturbações ambientais em uma floresta, incêndios e desmatamento, qual processo ecológico de recuperação ocorre? sucessão ecológica"
    );
    expect(r.materia).toBe("Biologia");
  });

  it("prioriza biologia em nicotina/enfisema", () => {
    const r = triarMateriaNatureza(
      "A nicotina altera a liberação de neurotransmissores causando dependência química e enfisema pulmonar com destruição das paredes dos alvéolos."
    );
    expect(r.materia).toBe("Biologia");
  });

  it("prioriza química em separação de misturas", () => {
    const r = triarMateriaNatureza(
      "Destilação por arraste de vapor de alecrim e capim-limão para óleo essencial; a etapa final de separação entre óleo e fase aquosa ocorre por decantação de líquidos imiscíveis."
    );
    expect(r.materia).toBe("Química");
  });

  it("prioriza física em colisões", () => {
    const r = triarMateriaNatureza(
      "Moedas com massas diferentes sofrem colisões frontais sucessivas sem atrito. Determine a velocidade após a colisão pela conservação da quantidade de movimento."
    );
    expect(r.materia).toBe("Física");
  });
});

describe("roteamentoLinguagensPorHeuristica", () => {
  it("pula IA quando confiança alta", () => {
    const r = roteamentoLinguagensPorHeuristica(
      "No contexto da tira, 'That'll be the day!' equivale, em português, a:",
      "COMUM"
    );
    expect(r?.disciplinaId).toBe("ingles");
    expect(r?.criterio).toBe("heuristica");
  });
});
