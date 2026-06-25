import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  completarBlocosIdiomaFaltante,
  montarBlocosFisicosCadastro,
  montarMapaOrdemNumero,
  normalizarEstruturaProva,
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
    assert.equal(map.get(21), 16);
    assert.equal(map.get(25), 20);
  });

  it("cadastro DUPLICATA EN/ES gera 25 ordens para 20 lógicas faixa 16–20", () => {
    const blocos = montarBlocosFisicosCadastro({
      totalEsperado: 20,
      politicaIdiomas: "DUPLICATA_EN_ES",
      idiomaQuestaoInicio: 16,
      idiomaQuestaoFim: 20,
      ordemIdiomasFaixa: "ESPANHOL_PRIMEIRO",
    });
    assert.ok(blocos);
    assert.equal(somaOrdensBlocos(blocos!), 25);
    assert.equal(blocos![1]!.titulo, "Espanhol");
    assert.equal(blocos![2]!.titulo, "Inglês");
    assert.equal(blocos![2]!.ordem_inicio, 21);
  });

  it("completa bloco Inglês quando IA só detectou Espanhol", () => {
    const base = {
      idiomas_estrangeiros: "duplicata_ingles_espanhol" as const,
      total_ocorrencias_detectado: 20,
      blocos: [
        { titulo: "Português", ordem_inicio: 1, ordem_fim: 15, questao_inicio: 1, questao_fim: 15 },
        { titulo: "Espanhol", ordem_inicio: 16, ordem_fim: 20, questao_inicio: 16, questao_fim: 20 },
      ],
    };
    const out = completarBlocosIdiomaFaltante(base);
    assert.equal(somaOrdensBlocos(out.blocos as typeof base.blocos), 25);
    assert.ok(out.blocos!.some((b) => b.titulo === "Inglês"));
  });

  it("normalizar usa cadastro sobre IA incompleta", () => {
    const out = normalizarEstruturaProva(
      {
        total_ocorrencias_detectado: 20,
        idiomas_estrangeiros: "somente_espanhol",
        blocos: [],
      },
      {
        totalEsperado: 20,
        politicaIdiomas: "DUPLICATA_EN_ES",
        idiomaQuestaoInicio: 16,
        idiomaQuestaoFim: 20,
        ordemIdiomasFaixa: "ESPANHOL_PRIMEIRO",
      }
    );
    assert.equal(out.total_ocorrencias_detectado, 25);
    assert.equal(out.idiomas_estrangeiros, "duplicata_ingles_espanhol");
  });
});
