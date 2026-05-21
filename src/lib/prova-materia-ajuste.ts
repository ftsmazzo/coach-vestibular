import type { QuestaoExtraida } from "@/lib/ai-extract-prova";

const PT_COMANDO =
  /de acordo com o texto|segundo o texto|com base no texto|no texto acima|no fragmento|interpreta(?:ç|c)[aã]o do texto|na entrevista|no trecho/i;

const ES_COMANDO =
  /de acuerdo con el texto|según el texto|segun el texto|con base en el texto/i;

const RE_EN =
  /\b(the|and|of|to|in|is|are|was|were|with|for|that|this|from|have|has|had|been|every|year|can|will|would|their|they|them|you|your|we|our|as|at|by|or|an|be|if|it|its|not|but|all|one|people|who|when|what|which|there|these|those|such|than|then|into|over|after|before|between|about|through|during|without|within|against|among|pets|home|shelter)\b/gi;

const RE_ES =
  /\b(el|la|los|las|de|del|en|es|son|que|por|para|con|una|uno|como|más|pero|también|está|están|año|años|según|después|antes|entre|sobre|sin|desde|hasta|donde|cuando|todo|toda|todos|todas|este|esta|estos|estas|ese|esa|eso|aquí|allí|muy|puede|pueden|ser|hay|fue|fueron|tiene|tienen|hacer|hecho|vida|mundo|país|ciudad|gente|personas|niño|niños|perro|gato)\b/gi;

const RE_PT_LITERATURA =
  /escrevivência|escrevivencia|conceição evaristo|conceicao evaristo|literatura canônica|literatura canonica|poetisa|escritora brasileira|produção escrita|producao escrita|meus textos|condição de mulher negra|condicao de mulher negra|entrevista, a escritora/i;

const RE_BIOLOGIA =
  /hotspot|biodiversidade|bioma[s]?\s+brasileir|espécies endêmicas|especies endemicas|mata atlântica|mata atlantica|caatinga|amazônia|amazonia|pantanal|desmatamento|vegetação nativa|vegetacao nativa|ecologia|endemismo/i;

const RE_MAT_FUNCOES =
  /função de variável|funcao de variavel|y\s*=\s*f\s*\(|f\s*\(\s*8\s*\)|sistema\s+cartesiano|graficamente representada|área do triângulo|area do triangulo/i;

const RE_MAT_MATRIZ =
  /matriz quadrada|ordem\s*2|elementos estão dispostos|determinante/i;

const RE_MAT_GEOM =
  /tetraedro|triângulos equiláteros|triangulos equilateros|pyraminx|cubo mágico|cubo magico|altura, então a área|faces é, em cm/i;

const SUBMATERIAS_MAT = new Set([
  "geometria",
  "geometria espacial",
  "geometria plana",
  "algebra",
  "álgebra",
  "aritmetica",
  "aritmética",
  "funcoes",
  "funções",
  "matrizes",
  "trigonometria",
  "estatistica",
  "estatística",
  "probabilidade",
]);

function contarMatches(texto: string, re: RegExp): number {
  return (texto.match(re) ?? []).length;
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

export function normalizarMateria(materia: string): string {
  const m = norm(materia);
  if (
    m === "geometria" ||
    m === "algebra" ||
    m === "álgebra" ||
    m === "aritmetica" ||
    m === "aritmética" ||
    m === "funcoes" ||
    m === "funções" ||
    m === "matrizes" ||
    m === "trigonometria" ||
    m === "estatistica" ||
    m === "estatística" ||
    m === "probabilidade" ||
    m.includes("geometria") && !m.includes("física")
  ) {
    return "matematica";
  }
  if (m.includes("matem")) return "matematica";
  if (m.includes("portugu") || m === "lp" || m.includes("lingua portuguesa")) return "portugues";
  if (m.includes("ingl")) return "ingles";
  if (m.includes("espan")) return "espanhol";
  if (m.includes("biolog")) return "biologia";
  if (m.includes("hist")) return "historia";
  if (m.includes("físic") || m.includes("fisic")) return "fisica";
  if (m.includes("quím") || m.includes("quim")) return "quimica";
  return m;
}

function pareceMateriaPortugues(materia: string): boolean {
  return normalizarMateria(materia) === "portugues";
}

function pareceMateriaEspanhol(materia: string): boolean {
  return normalizarMateria(materia) === "espanhol";
}

function pareceMateriaIngles(materia: string): boolean {
  return normalizarMateria(materia) === "ingles";
}

function materiaEhSubcampoMatematica(materia: string): boolean {
  return SUBMATERIAS_MAT.has(norm(materia));
}

function normalizarMateriaMatematica(questao: QuestaoExtraida): QuestaoExtraida {
  const m = norm(questao.materia);
  if (m !== "matematica" && !materiaEhSubcampoMatematica(questao.materia)) {
    return questao;
  }
  const assuntoAtual = questao.assunto.trim();
  const assunto =
    materiaEhSubcampoMatematica(questao.materia) && assuntoAtual.length < 3
      ? questao.materia
      : assuntoAtual;
  return {
    ...questao,
    materia: "Matemática",
    assunto: assunto || questao.assunto,
  };
}

function ajustarPorConteudoDisciplinar(
  texto: string,
  questao: QuestaoExtraida
): QuestaoExtraida {
  let { materia, assunto, observacoes } = questao;
  const t = texto;

  if (RE_BIOLOGIA.test(t)) {
    const nm = normalizarMateria(materia);
    if (nm === "historia" || nm === "geografia" || nm === "portugues") {
      materia = "Biologia";
      assunto = /hotspot|bioma|endêm|endem/i.test(t)
        ? "Ecologia — biodiversidade e biomas brasileiros"
        : assunto === "A classificar"
          ? "Ecologia"
          : assunto;
      observacoes = observacoes ?? "Conteúdo de ecologia/biomas (não História).";
    }
  }

  if (RE_PT_LITERATURA.test(t) && contarMatches(t, RE_EN) < 10) {
    const nm = normalizarMateria(materia);
    if (nm !== "ingles" && nm !== "espanhol") {
      materia = "Português";
      assunto = /entrevista|escrevivência|escrevivencia/i.test(t)
        ? "Interpretação de texto — literatura e entrevista"
        : "Interpretação de texto";
      observacoes = observacoes ?? "Texto em português (literatura/entrevista).";
    }
  }

  if (RE_MAT_FUNCOES.test(t)) {
    materia = "Matemática";
    assunto = "Funções — gráfico e área no plano cartesiano";
  } else if (RE_MAT_MATRIZ.test(t)) {
    materia = "Matemática";
    assunto = "Matrizes";
  } else if (RE_MAT_GEOM.test(t)) {
    materia = "Matemática";
    assunto = "Geometria espacial — áreas e sólidos";
  }

  if (materia === questao.materia && assunto === questao.assunto && observacoes === questao.observacoes) {
    return questao;
  }
  return { ...questao, materia, assunto, observacoes };
}

export function ajustarMateriaPorIdiomaDoTexto(
  textoQuestao: string,
  questao: QuestaoExtraida
): QuestaoExtraida {
  const texto = textoQuestao.trim();
  if (texto.length < 80) return questao;

  const en = contarMatches(texto, RE_EN);
  const es = contarMatches(texto, RE_ES);
  const cmdPt = PT_COMANDO.test(texto);

  let materia = questao.materia;
  let assunto = questao.assunto;
  let observacoes = questao.observacoes;

  const passagemIngles = en >= 14 && en > es * 1.4;
  const passagemEspanhol = es >= 14 && es > en * 1.4 && !passagemIngles;

  if (passagemIngles && cmdPt && !pareceMateriaIngles(materia)) {
    materia = "Inglês";
    if (pareceMateriaPortugues(assunto) || assunto === "A classificar") {
      assunto = "Compreensão de texto em inglês";
    }
    observacoes =
      observacoes ?? "Texto-base em inglês com comando em português (padrão vestibular).";
  } else if (passagemEspanhol && cmdPt && !pareceMateriaEspanhol(materia)) {
    materia = "Espanhol";
    if (assunto === "A classificar" || pareceMateriaPortugues(assunto)) {
      assunto = "Compreensão de texto em espanhol";
    }
    observacoes =
      observacoes ?? "Texto-base em espanhol com comando em português (padrão vestibular).";
  }

  const parcial = { ...questao, materia, assunto, observacoes };
  return ajustarClassificacaoPorConteudo(texto, parcial);
}

/** Pipeline: idioma → disciplina por palavras-chave → matéria Matemática unificada. */
export function ajustarClassificacaoPorConteudo(
  textoQuestao: string,
  questao: QuestaoExtraida
): QuestaoExtraida {
  const texto = textoQuestao.trim();
  if (texto.length < 40) return normalizarMateriaMatematica(questao);

  let q = questao;
  const en = contarMatches(texto, RE_EN);
  const cmdPt = PT_COMANDO.test(texto);
  if (!(en >= 14 && cmdPt)) {
    q = ajustarPorConteudoDisciplinar(texto, q);
  }
  return normalizarMateriaMatematica(q);
}
