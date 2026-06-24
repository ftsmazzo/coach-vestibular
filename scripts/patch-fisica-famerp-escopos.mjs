#!/usr/bin/env node
/** Enriquece os 10 escopos FAMERP 61–70 no catálogo de Física. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const fisPath = path.join(__dirname, "..", "data", "conhecimento-catalog", "catalogo-fisica-v1.2.0.json");

const MAT_NAO = [
  "mat.funcoes.geral.conceito_grafico",
  "mat.funcoes.geral.afim",
  "mat.aritmetica.numeros.razao_proporcao",
  "mat.aritmetica.numeros.porcentagem",
  "mat.algebra.equacoes.primeiro_grau",
  "mat.algebra.equacoes.segundo_grau",
  "mat.estatistica.medidas.graficos",
];

const HINTS_ANTI_MAT = [
  "porcentagem pura",
  "regra de três sem grandezas físicas",
  "função matemática abstrata",
  "equação sem fenômeno físico",
];

/** @type {Record<string, object>} */
const ENRIQUECIMENTOS = {
  "fis.mecanica.cinematica.mru": {
    keywords: [
      "velocidade média",
      "velocidade media",
      "ônibus",
      "onibus",
      "intervalo entre saídas",
      "intervalo entre saidas",
      "tempo de percurso",
      "horário de partida",
    ],
    keywordsContexto: ["linha de transporte", "terminal", "ponto de embarque"],
    exemplosEnunciado: [
      "Dois ônibus saem do terminal com intervalo fixo e mesma velocidade média; calcule o tempo até o encontro ou o instante em que o segundo alcança o primeiro.",
      "Calcular tempo de percurso a partir de velocidade média e intervalo entre saídas de ônibus.",
    ],
    negativeHints: [...HINTS_ANTI_MAT, "função afim sem movimento"],
    naoConfundirCom: [
      "fis.mecanica.cinematica.mruv",
      "fis.mecanica.cinematica.graficos",
      ...MAT_NAO.slice(0, 3),
    ],
    regraDesempate:
      "Velocidade média + tempo de percurso em contexto de movimento (ônibus, carro, móvel) → MRU. Cálculo/proporção sozinhos não levam a Matemática (fisica_prevalece_quando_ha_grandezas_e_fenomeno).",
  },
  "fis.mecanica.cinematica.graficos": {
    keywords: [
      "gráfico v x t",
      "grafico v x t",
      "inclinação do gráfico de velocidade",
      "aceleração no gráfico",
    ],
    keywordsContexto: ["área sob a curva", "deslocamento"],
    exemplosEnunciado: [
      "No gráfico velocidade×tempo, a inclinação representa a aceleração; a área sob a curva representa o deslocamento.",
    ],
    negativeHints: HINTS_ANTI_MAT,
    naoConfundirCom: [
      "fis.mecanica.dinamica.newton",
      "fis.mecanica.cinematica.mru",
      "mat.funcoes.geral.conceito_grafico",
    ],
    regraDesempate:
      "Se pede apenas interpretar o gráfico (inclinação/área) → aqui. Se pede relacionar aceleração ao sentido da força resultante → fis.mecanica.dinamica.newton (secundário possível).",
  },
  "fis.mecanica.dinamica.newton": {
    keywords: [
      "gráfico v x t",
      "sentido da força resultante",
      "aceleração e força",
      "2ª lei de newton",
    ],
    keywordsContexto: ["inclinação do gráfico", "diagrama de corpo livre"],
    descricao:
      "Aplicação das leis de Newton, força resultante e diagrama de corpo livre; interpretação de aceleração em gráfico v×t ligada ao sentido da força. NÃO cobre conservação de energia como método principal. NÃO confundir com leitura pura de gráfico sem vínculo com força.",
    exemplosEnunciado: [
      "Interpretar aceleração em gráfico v×t e relacionar ao sentido da força resultante (2ª lei de Newton).",
      "Um bloco sofre duas forças horizontais; determine sua aceleração pela força resultante.",
    ],
    negativeHints: [...HINTS_ANTI_MAT, "só calcular inclinação sem força"],
    naoConfundirCom: [
      "fis.mecanica.cinematica.graficos",
      "fis.mecanica.energia.conservacao",
      "mat.funcoes.geral.conceito_grafico",
    ],
    regraDesempate:
      "Gráfico v×t + força resultante/aceleração como conceito dinâmico → aqui. Gráfico sem dinâmica → fis.mecanica.cinematica.graficos.",
  },
  "fis.mecanica.gravitacao.orbitas": {
    keywords: [
      "velocidade orbital",
      "força centrípeta",
      "força gravitacional",
      "igualar forças",
      "movimento circular",
    ],
    keywordsContexto: ["satélite geoestacionário", "órbita circular"],
    descricao:
      "Órbitas circulares, satélites e Kepler; igualar força gravitacional à resultante centrípeta para obter velocidade orbital. NÃO cobre apenas peso em superfície terrestre.",
    exemplosEnunciado: [
      "Igualar a força gravitacional à força centrípeta para obter a velocidade orbital de um satélite.",
    ],
    negativeHints: HINTS_ANTI_MAT,
    naoConfundirCom: [
      "fis.mecanica.gravitacao.lei_gravitacao",
      "mat.algebra.equacoes.segundo_grau",
    ],
    regraDesempate:
      "Satélite/órbita com Fg = Fc → aqui. Apenas P=m·g na Terra → lei_gravitacao.",
  },
  "fis.hidrostatica.empuxo.arquimedes": {
    keywords: [
      "submersão total",
      "submersao total",
      "força adicional",
      "empuxo",
      "flutuação parcial",
    ],
    keywordsContexto: ["corpo flutuando", "mergulho", "tanque d'água"],
    descricao:
      "Princípio de Arquimedes: empuxo, flutuação e submersão; determinar força adicional para submersão total. NÃO cobre apenas volume geométrico abstrato.",
    exemplosEnunciado: [
      "Aplicar empuxo/flutuação para determinar a força adicional necessária à submersão total de um corpo.",
    ],
    negativeHints: [...HINTS_ANTI_MAT, "volume de sólido geométrico puro"],
    naoConfundirCom: [
      "fis.hidrostatica.empuxo.aplicacoes",
      "mat.geometria_espacial.solidos.esfera",
    ],
    regraDesempate: "Empuxo/força de flutuação → aqui. Só cálculo de volume de esfera → Geometria (Mat).",
  },
  "fis.termologia.calor.dilatacao": {
    keywords: [
      "esfera aquecida",
      "esfera metálica",
      "dilatação linear e volumétrica",
      "raio e volume",
    ],
    keywordsContexto: ["gap de dilatação", "anel", "tampa"],
    descricao:
      "Dilatação linear, superficial e volumétrica; relação entre variação de raio e volume em sólidos (ex.: esfera aquecida). NÃO cobre porcentagem abstrata sem coeficiente de dilatação.",
    exemplosEnunciado: [
      "Relacionar dilatação volumétrica e linear em uma esfera aquecida (variação de raio e volume).",
    ],
    negativeHints: HINTS_ANTI_MAT,
    naoConfundirCom: ["fis.termologia.calor.calorimetria", "mat.aritmetica.numeros.porcentagem"],
    regraDesempate: "Coeficiente de dilatação + ΔL/ΔV físicos → aqui.",
  },
  "fis.termologia.termodinamica.gases": {
    keywords: [
      "densidade do gás",
      "densidade do gas",
      "recipiente hermético",
      "volume constante",
      "pV=nRT",
      "clapeyron",
    ],
    keywordsContexto: ["gás confinado", "temperatura e pressão"],
    descricao:
      "Gás ideal, transformações e densidade em recipiente de volume constante; lei dos gases. NÃO cobre apenas manipulação algébrica de pV=nRT sem contexto físico.",
    exemplosEnunciado: [
      "Analisar como a densidade de um gás ideal varia em recipiente hermético de volume constante ao aquecer ou comprimir.",
    ],
    negativeHints: HINTS_ANTI_MAT,
    naoConfundirCom: [
      "fis.termologia.termodinamica.primeira_lei",
      "mat.algebra.equacoes.primeiro_grau",
    ],
    regraDesempate: "Densidade/estado do gás ideal → aqui. Só isolar variável em pV=nRT sem fenômeno → revisar se não é Mat.",
  },
  "fis.optica.geometrica.reflexao": {
    keywords: [
      "simetria",
      "imagem conjugada",
      "espelho plano",
      "distância objeto-imagem",
    ],
    keywordsContexto: ["campo de visão", "retrovisor"],
    descricao:
      "Reflexão em espelhos planos; localização de imagem por simetria. NÃO cobre espelhos esféricos com equação de gauss como foco principal.",
    exemplosEnunciado: [
      "Determinar a posição da imagem de um objeto em espelho plano por simetria/reflexão.",
    ],
    negativeHints: [...HINTS_ANTI_MAT, "coordenadas cartesianas abstratas"],
    naoConfundirCom: [
      "fis.optica.geometrica.refracao",
      "mat.geometria_analitica.plano.distancia_ponto",
    ],
    regraDesempate: "Espelho plano + simetria → aqui. Lentes/gauss → lentes.",
  },
  "fis.eletrodinamica.potencia.consumo": {
    keywords: [
      "energia em kWh",
      "tempo de funcionamento",
      "potência e consumo",
      "conta de energia",
    ],
    keywordsContexto: ["aparelho elétrico", "tarifa", "horas ligado"],
    descricao:
      "Potência elétrica (P), energia (E=P·t) e consumo em kWh; relação entre potência, tempo e energia. NÃO cobre porcentagem de desconto na conta.",
    exemplosEnunciado: [
      "Relacionar potência elétrica, energia em kWh e tempo de funcionamento de um aparelho.",
    ],
    negativeHints: [...HINTS_ANTI_MAT, "juros", "desconto percentual"],
    naoConfundirCom: [
      "fis.eletrodinamica.potencia.eletrica_joule",
      "mat.financeira.juros.simples",
      "mat.aritmetica.numeros.porcentagem",
    ],
    regraDesempate: "P, E, kWh e tempo → aqui. Só porcentagem financeira → Mat.",
  },
  "fis.magnetismo.campo.forca_lorentz": {
    keywords: [
      "módulo da velocidade",
      "modulo da velocidade",
      "direção da velocidade",
      "trabalho da força magnética",
      "trajetória circular",
    ],
    keywordsContexto: ["próton", "elétron", "partícula em campo B"],
    descricao:
      "Força magnética sobre condutor ou partícula carregada (Lorentz); altera direção da velocidade, não o módulo (trabalho nulo). NÃO cobre trigonometria pura do círculo.",
    exemplosEnunciado: [
      "Reconhecer que a força magnética sobre partícula carregada altera a direção da velocidade, mas não seu módulo.",
    ],
    negativeHints: HINTS_ANTI_MAT,
    naoConfundirCom: [
      "fis.magnetismo.campo.ima_forca",
      "mat.trigonometria.relacoes.identidades",
    ],
    regraDesempate: "Força magnética + carga em movimento → aqui.",
  },
  "fis.fisica_moderna.quantum.fotoeletrico": {
    keywords: [
      "Ef=hf",
      "E = hf",
      "energia mínima",
      "energia do fóton",
      "emissão de elétron",
      "função trabalho",
    ],
    keywordsContexto: ["placa metálica", "luz ultravioleta", "frequência de corte"],
    descricao:
      "Efeito fotoelétrico: energia do fóton Ef=h·f, função trabalho e emissão de elétrons. NÃO cobre espectro químico ou equação de reação.",
    exemplosEnunciado: [
      "Aplicar Ef = h·f para verificar quais fótons superam a energia mínima de emissão de elétrons.",
    ],
    negativeHints: [...HINTS_ANTI_MAT, "balanceamento químico"],
    naoConfundirCom: [
      "fis.fisica_moderna.quantum.modelos",
      "quim.ambiental.poluicao.atmosferica",
    ],
    regraDesempate: "Fóton + efeito fotoelétrico + Planck → aqui.",
  },
};

function mergeUnique(arr, add) {
  return [...new Set([...(arr ?? []), ...add])];
}

function patchEscopos(assuntos) {
  for (const ass of assuntos) {
    for (const dom of ass.dominios ?? []) {
      for (const esc of dom.escopos ?? []) {
        const patch = ENRIQUECIMENTOS[esc.id];
        if (!patch) continue;
        if (patch.descricao) esc.descricao = patch.descricao;
        if (patch.keywords) esc.keywords = mergeUnique(esc.keywords, patch.keywords);
        if (patch.keywordsContexto) {
          esc.keywordsContexto = mergeUnique(esc.keywordsContexto, patch.keywordsContexto);
        }
        if (patch.exemplosEnunciado) {
          esc.exemplosEnunciado = mergeUnique(esc.exemplosEnunciado, patch.exemplosEnunciado);
        }
        if (patch.negativeHints) {
          esc.negativeHints = mergeUnique(esc.negativeHints, patch.negativeHints);
        }
        if (patch.naoConfundirCom) {
          esc.naoConfundirCom = mergeUnique(esc.naoConfundirCom, patch.naoConfundirCom);
        }
        if (patch.regraDesempate) esc.regraDesempate = patch.regraDesempate;
      }
    }
  }
}

const fis = JSON.parse(fs.readFileSync(fisPath, "utf8"));
fis.catalogVersion = "1.2.2";
fis.changelog = fis.changelog ?? [];
fis.changelog.unshift(
  "1.2.2: Refino FAMERP 61–70 — enriquecidos 11 escopos (MRU ônibus, Newton+gráfico, órbitas, Arquimedes, dilatação esfera, gás ideal densidade, espelho plano, kWh, Lorentz, fotoelétrico) com keywords, exemplos e desempate vs Mat."
);
patchEscopos(fis.assuntos);
fs.writeFileSync(fisPath, JSON.stringify(fis, null, 2) + "\n");
console.log("Catálogo Física v1.2.2 — escopos FAMERP enriquecidos.");
