import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  aplicarRoteamentoDeterministicoLinguagens,
  heuristicaHumanasDisciplina,
  heuristicaLinguagensDisciplina,
  roteamentoLinguagensPorHeuristica,
  validarRoteamentoLinguagensPosIA,
} from "@/lib/enem-classificar/heuristica-roteamento-disciplina";
import { fisicaPrevaleceSobreMatematica } from "@/lib/enem-classificar/fisica-vs-matematica";
import { triarMateriaNatureza } from "@/lib/enem-classificar/triagem-natureza";
import { triarNaturezaTransversal } from "@/lib/enem-classificar/triagem-natureza-transversal";
import {
  deveProcessarQuestaoN1,
  n1EhManual,
  parseClassificacaoN1,
  resolverOpcoesFaseN1,
} from "@/lib/classificacao-n1-types";
import { validarExatasPosIA, validarTriagemNaturezaPosIA } from "@/lib/enem-classificar/validacao-pos-ia-n1";
import { montarBlocoLinhaClassificacao } from "@/lib/enem-classificar/linha-classificacao";
import { resolverAreaMacroQuestao } from "@/lib/inferir-area-macro-conteudo";

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

  it("interpretação PT (COMUM) não vira inglês após IA errada", () => {
    const texto =
      "De acordo com o texto, a principal função social da linguagem na sociedade brasileira é promover a comunicação entre diferentes grupos e garantir o acesso à informação disponível para todos os cidadãos.";
    const iaErrada = {
      disciplinaId: "ingles",
      criterio: "lingua_texto_base",
      confianca: 0.99,
      justificativa: "falso positivo",
      sinalizadorRevisao: false,
    };
    const corrigida = validarRoteamentoLinguagensPosIA(texto, "COMUM", iaErrada);
    assert.equal(corrigida.disciplinaId, "portugues");
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

describe("modos N1 reprocessamento", () => {
  const n1Auto = parseClassificacaoN1(
    JSON.stringify({
      versao: "n1-v1",
      area: "natureza",
      catalogoId: "biologia",
      confianca: 0.9,
      criterio: "heuristica",
      justificativa: "teste",
      origem: "auto",
      classificadoEm: "2026-01-01T00:00:00.000Z",
    })
  )!;
  const n1Manual = parseClassificacaoN1(
    JSON.stringify({
      versao: "n1-v1",
      area: "humanas",
      catalogoId: "sociologia",
      confianca: 1,
      criterio: "manual",
      justificativa: "manual",
      origem: "manual",
      classificadoEm: "2026-01-01T00:00:00.000Z",
    })
  )!;

  it("apenasFaltantes pula quem já tem N1", () => {
    const opts = resolverOpcoesFaseN1({ apenasFaltantes: true });
    assert.equal(deveProcessarQuestaoN1(n1Auto, opts).processar, false);
    assert.equal(deveProcessarQuestaoN1(null, opts).processar, true);
  });

  it("reprocessarTodas preserva manuais por padrão", () => {
    const opts = resolverOpcoesFaseN1({ reprocessarTodas: true, preservarManuais: true });
    assert.equal(deveProcessarQuestaoN1(n1Auto, opts).processar, true);
    assert.equal(deveProcessarQuestaoN1(n1Manual, opts).processar, false);
    assert.equal(n1EhManual(n1Manual), true);
  });

  it("forcarTudo reprocessa manuais", () => {
    const opts = resolverOpcoesFaseN1({ forcarTudo: true });
    assert.equal(deveProcessarQuestaoN1(n1Manual, opts).processar, true);
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

describe("linha de classificação recursiva", () => {
  it("N2 inclui N1 e instrução de fase", () => {
    const n1 = {
      versao: "n1-v1" as const,
      area: "humanas" as const,
      catalogoId: "historia",
      confianca: 0.91,
      criterio: "guardrail",
      justificativa: "teste",
      classificadoEm: "2026-01-01T00:00:00.000Z",
    };
    const bloco = montarBlocoLinhaClassificacao({ n1 }, "N2");
    assert.match(bloco, /N1: humanas → historia/);
    assert.match(bloco, /escolha o escopo N2/);
    assert.doesNotMatch(bloco, /N2: hist\./);
  });

  it("N3 inclui N1 e N2 com âncora", () => {
    const n1 = {
      versao: "n1-v1" as const,
      area: "humanas" as const,
      catalogoId: "historia",
      confianca: 0.91,
      criterio: "guardrail",
      justificativa: "teste",
      classificadoEm: "2026-01-01T00:00:00.000Z",
    };
    const escopo = "hist.brasil_republica.primeira_republica.modernismo_cultura";
    const bloco = montarBlocoLinhaClassificacao({ n1, escopoN2Id: escopo }, "N3");
    assert.match(bloco, /N1: humanas → historia/);
    assert.match(bloco, new RegExp(`N2: ${escopo.replace(/\./g, "\\.")}`));
    assert.match(bloco, /conhecimento exigido \(N3\)/);
  });
});

describe("inferência de área macro por conteúdo (Fase 4 N1)", () => {
  it("inglês → linguagens sem areaBloco", () => {
    const texto =
      "No contexto da tira, a fala 'That'll be the day!' equivale, em português, a:";
    const r = resolverAreaMacroQuestao(texto, { areaBloco: null, materia: "A classificar" });
    assert.equal(r?.area, "linguagens");
    assert.equal(r?.via, "conteudo");
  });

  it("sociologia → humanas sem cadastro", () => {
    const texto =
      "Com base no ensaio de Simone de Beauvoir, identifique como a sociedade reduz o valor do indivíduo à capacidade produtiva.";
    const r = resolverAreaMacroQuestao(texto, { materia: "A classificar" });
    assert.equal(r?.area, "humanas");
  });

  it("sucessão ecológica → natureza", () => {
    const texto =
      "Após perturbações ambientais em uma floresta, qual processo ecológico de recuperação ocorre? sucessão ecológica";
    const r = resolverAreaMacroQuestao(texto, {});
    assert.equal(r?.area, "natureza");
  });

  it("matriz → exatas", () => {
    const texto = "Considere a matriz quadrada de ordem 2 e calcule o determinante.";
    const r = resolverAreaMacroQuestao(texto, {});
    assert.equal(r?.area, "exatas");
  });

  it("conteúdo prevalece sobre areaBloco errado", () => {
    const texto =
      "A nicotina altera a liberação de neurotransmissores causando enfisema pulmonar com destruição dos alvéolos.";
    const r = resolverAreaMacroQuestao(texto, {
      areaBloco: "Exatas",
      materia: "A classificar",
    });
    assert.equal(r?.area, "natureza");
    assert.equal(r?.via, "conteudo");
  });
});
