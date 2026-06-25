import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aplicarRoteamentoDeterministicoLinguagens,
  heuristicaHumanasDisciplina,
  heuristicaLinguagensDisciplina,
  roteamentoLinguagensPorHeuristica,
} from "@/lib/enem-classificar/heuristica-roteamento-disciplina";
import { fisicaPrevaleceSobreMatematica } from "@/lib/enem-classificar/fisica-vs-matematica";
import { triarMateriaNatureza } from "@/lib/enem-classificar/triagem-natureza";
import { triarNaturezaTransversal } from "@/lib/enem-classificar/triagem-natureza-transversal";
import { validarExatasPosIA, validarTriagemNaturezaPosIA } from "@/lib/enem-classificar/validacao-pos-ia-n1";

describe("regressão N1 produção", () => {
  it("Q29 tira inglês expressão idiomática → Inglês", () => {
    const texto =
      "No contexto da tira, a fala da menina no segundo quadrinho 'That'll be the day!' equivale, em português, a:";
    assert.equal(heuristicaLinguagensDisciplina(texto)?.disciplinaId, "ingles");
    assert.equal(roteamentoLinguagensPorHeuristica(texto, "COMUM")?.disciplinaId, "ingles");
  });

  it("Q30 tira inglês inferência → Inglês", () => {
    const texto =
      "O trecho da tira que faz com que o argumento do menino seja invalidado é:\nDon't try to fool me";
    assert.equal(heuristicaLinguagensDisciplina(texto)?.disciplinaId, "ingles");
  });

  it("Q58 Beauvoir velhice/produtivismo → Sociologia", () => {
    const texto =
      "Com base no ensaio de Simone de Beauvoir, identifique como a sociedade reduz o valor do indivíduo à capacidade produtiva e promove exclusão social dos idosos.";
    assert.equal(heuristicaHumanasDisciplina(texto)?.disciplinaId, "sociologia");
  });

  it("Q60 Lenine aceleração social → Sociologia", () => {
    const texto =
      "A canção de Lenine critica a aceleração do cotidiano na sociedade contemporânea e propõe a desaceleração como resistência à lógica instável da vida social.";
    assert.equal(heuristicaHumanasDisciplina(texto)?.disciplinaId, "sociologia");
  });

  it("crédito de carbono → Geografia", () => {
    const texto =
      "O crédito de carbono funciona como instrumento de compensação de emissões no mercado de carbono e nas políticas climáticas.";
    assert.equal(heuristicaHumanasDisciplina(texto)?.disciplinaId, "geografia");
  });

  it("eutrofização por esgoto → Geografia", () => {
    const texto =
      "O tratamento de esgoto reduz o lançamento de matéria orgânica nos corpos hídricos, prevenindo a eutrofização e a degradação da qualidade da água.";
    assert.equal(heuristicaHumanasDisciplina(texto)?.disciplinaId, "geografia");
  });

  it("Vila Sahy áreas de risco → Geografia", () => {
    const texto =
      "Moradores da Vila Sahy permanecem em áreas urbanas de risco sujeitas a deslizamentos e inundações, exigindo obras de contenção de encostas.";
    assert.equal(heuristicaHumanasDisciplina(texto)?.disciplinaId, "geografia");
  });

  it("método científico → Natureza Transversal", () => {
    const texto =
      "Após a formulação de uma hipótese, o método científico exige sequencialmente a experimentação e a coleta de dados para análise crítica.";
    assert.equal(triarNaturezaTransversal(texto).catalogoId, "natureza_transversal");
  });

  it("sucessão ecológica → Biologia", () => {
    const texto =
      "Após perturbações ambientais em uma floresta, incêndios e desmatamento, qual processo ecológico de recuperação ocorre? sucessão ecológica";
    assert.equal(triarMateriaNatureza(texto).materia, "Biologia");
  });

  it("nicotina neurotransmissores enfisema → Biologia", () => {
    const texto =
      "A nicotina altera a liberação de neurotransmissores causando dependência química e enfisema pulmonar com destruição das paredes dos alvéolos.";
    assert.equal(triarMateriaNatureza(texto).materia, "Biologia");
  });

  it("óleo essencial decantação → Química", () => {
    const texto =
      "Destilação por arraste de vapor de alecrim e capim-limão para óleo essencial; a etapa final de separação entre óleo e fase aquosa ocorre por decantação de líquidos imiscíveis.";
    assert.equal(triarMateriaNatureza(texto).materia, "Química");
  });

  it("colisões moedas sem atrito → Física", () => {
    const texto =
      "Moedas com massas diferentes sofrem colisões frontais sucessivas sem atrito. Determine a velocidade após a colisão pela conservação da quantidade de movimento.";
    assert.equal(triarMateriaNatureza(texto).materia, "Física");
    assert.equal(fisicaPrevaleceSobreMatematica(texto).prevalece, true);
  });

  it("ângulos figura plana sem fenômeno físico → Matemática", () => {
    const texto =
      "Na figura plana formada por segmentos de reta, determine a soma das medidas dos ângulos indicados nos vértices do polígono.";
    assert.equal(fisicaPrevaleceSobreMatematica(texto).prevalece, false);
    assert.equal(validarExatasPosIA(texto, "matematica").catalogoId, "matematica");
  });
});

describe("pós-validação Natureza corrige IA errada", () => {
  it("corrige IA Química para Biologia em sucessão ecológica", () => {
    const texto =
      "Após perturbações ambientais e incêndios florestais, ocorre sucessão ecológica na comunidade biológica.";
    const ia = { materia: "Química" as const, confianca: 0.8, motivo: "IA: umidade do solo" };
    const heur = triarMateriaNatureza(texto);
    const v = validarTriagemNaturezaPosIA(texto, ia, heur);
    assert.equal(v.catalogoId, "biologia");
    assert.equal(v.via, "heuristica");
  });

  it("não força português em rota indefinida da IA", () => {
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
    assert.equal(rota.disciplinaId, "indefinido");
  });
});
