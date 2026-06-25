import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  montarMapaOrdemNumero,
  resolverTotalOcorrencias,
  somaOrdensBlocos,
} from "./prova-pipeline-ordem-numero";

describe("prova-pipeline-ordem-numero", () => {
  it("monta mapa com blocos EN/ES e números repetidos", () => {
    const estrutura = {
      total_ocorrencias_detectado: 25,
      blocos: [
        { titulo: "PT", ordem_inicio: 1, ordem_fim: 15, questao_inicio: 1, questao_fim: 15 },
        { titulo: "ES", ordem_inicio: 16, ordem_fim: 20, questao_inicio: 16, questao_fim: 20 },
        { titulo: "EN", ordem_inicio: 21, ordem_fim: 25, questao_inicio: 16, questao_fim: 20 },
      ],
    };
    assert.equal(somaOrdensBlocos(estrutura.blocos), 25);
    assert.equal(resolverTotalOcorrencias(estrutura), 25);
    const map = montarMapaOrdemNumero(estrutura, 25);
    assert.equal(map.get(1), 1);
    assert.equal(map.get(15), 15);
    assert.equal(map.get(16), 16);
    assert.equal(map.get(20), 20);
    assert.equal(map.get(21), 16);
    assert.equal(map.get(25), 20);
  });
});
