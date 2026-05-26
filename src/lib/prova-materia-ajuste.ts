import type { QuestaoExtraida } from "@/lib/ai-extract-prova";

const PT_COMANDO =
  /de acordo com o texto|segundo o texto|com base no texto|no texto acima|no fragmento|interpreta(?:ç|c)[aã]o do texto|na entrevista|no trecho/i;

const ES_COMANDO =
  /de acuerdo con el texto|según el texto|segun el texto|con base en el texto/i;

/** Comando em inglês (UFU e simulados). */
const EN_COMANDO =
  /fill in the blanks|choose the correct answer|according to the text|read the text|select the alternative|complete the text|which best complete/i;

/** Inglês — palavras típicas de passagem em EN, raras em PT. */
const RE_EN =
  /\b(the|and|of|to|in|is|are|was|were|with|for|that|this|from|have|has|had|been|every|year|can|will|would|their|they|them|you|your|we|our|as|at|by|or|an|be|if|it|its|not|but|all|one|people|who|when|what|which|there|these|those|such|than|then|into|over|after|before|between|about|through|during|without|within|against|among|pets|home|shelter|adopted|writing|children|world)\b/gi;

/** Espanhol — só marcadores fortes (evita confundir com português). */
const RE_ES_FORTE =
  /\b(según|segun|acuerdo|también|tambien|están|estan|años|anos|después|despues|además|ademas|español|espanol|usted|ellos|ellas|había|habia|niñ[oa]s?|señor|señora|¿|¡)\b/gi;

/** Português — marcadores ortográficos e lexicais fortes. */
const RE_PT_FORTE =
  /\b(ção|ções|ão|ões|ã|õ|ç|mente|brasileir|escrita|leitura|entrevista|escritora|adolescência|adolescencia|infância|infancia|perguntas|dúvidas|duvidas|português|portugues|disponível|disponivel|acesso em|sociedade brasileira|menina|menino|já|não|nao|também|tambem|através|atraves|alguma coisa)\b/gi;

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
    (m.includes("geometria") && !m.includes("física"))
  ) {
    return "matematica";
  }
  if (m.includes("matem")) return "matematica";
  if (m.includes("portugu") || m === "lp" || m.includes("lingua portuguesa"))
    return "portugues";
  if (m.includes("ingl")) return "ingles";
  if (m.includes("espan")) return "espanhol";
  if (m.includes("biolog")) return "biologia";
  if (m.includes("hist")) return "historia";
  if (m.includes("físic") || m.includes("fisic")) return "fisica";
  if (m.includes("quím") || m.includes("quim")) return "quimica";
  return m;
}

/** Passagem em inglês (comando em PT ou em EN). */
export function detectarPassagemEspanhol(texto: string): boolean {
  const t = texto.trim();
  if (t.length < 60) return false;
  if (textoIndicaPortugues(t)) return false;
  const es = contarMatches(t, RE_ES_FORTE);
  const pt = contarMatches(t, RE_PT_FORTE);
  const en = contarMatches(t, RE_EN);
  const cmdEs = ES_COMANDO.test(t);
  const cmdPt = PT_COMANDO.test(t);
  return es >= 6 && es > pt && es > en && (cmdEs || !cmdPt);
}

export function detectarPassagemIngles(texto: string): boolean {
  const t = texto.trim();
  if (t.length < 60) return false;
  if (RE_PT_LITERATURA.test(t) && contarMatches(t, RE_EN) < 18) return false;

  const en = contarMatches(t, RE_EN);
  const pt = contarMatches(t, RE_PT_FORTE);
  const cmdPt = PT_COMANDO.test(t);
  const cmdEn = EN_COMANDO.test(t);

  if (en >= 18 && en > pt * 1.5) return true;
  return en >= 10 && en > pt * 1.2 && (cmdPt || cmdEn);
}

export function textoIndicaIngles(texto: string): boolean {
  return detectarPassagemIngles(texto);
}

/** Texto-base claramente em português (não espanhol). */
export function textoIndicaPortugues(texto: string): boolean {
  const t = texto.trim();
  if (t.length < 80) return false;
  if (RE_PT_LITERATURA.test(t)) return true;
  const pt = contarMatches(t, RE_PT_FORTE);
  const es = contarMatches(t, RE_ES_FORTE);
  const en = contarMatches(t, RE_EN);
  return pt >= 10 && pt > es * 2 && en < 12;
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

function forcarPortuguesLiteratura(
  texto: string,
  questao: QuestaoExtraida
): QuestaoExtraida | null {
  if (!textoIndicaPortugues(texto)) return null;
  return {
    ...questao,
    materia: "Português",
    assunto: /entrevista|escrevivência|escrevivencia/i.test(texto)
      ? "Interpretação de texto — literatura e entrevista"
      : questao.assunto === "A classificar" ||
          pareceMateriaEspanhol(questao.materia) ||
          pareceMateriaIngles(questao.materia)
        ? "Interpretação de texto"
        : questao.assunto,
    observacoes:
      questao.observacoes ?? "Texto-base em português (literatura/interpretação).",
  };
}

function ajustarPorConteudoDisciplinar(
  texto: string,
  questao: QuestaoExtraida
): QuestaoExtraida {
  const ptLit = forcarPortuguesLiteratura(texto, questao);
  if (ptLit) return ptLit;

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

  if (
    materia === questao.materia &&
    assunto === questao.assunto &&
    observacoes === questao.observacoes
  ) {
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

  const ptLit = forcarPortuguesLiteratura(texto, questao);
  if (ptLit) return normalizarMateriaMatematica(ptLit);

  const en = contarMatches(texto, RE_EN);
  const es = contarMatches(texto, RE_ES_FORTE);
  const pt = contarMatches(texto, RE_PT_FORTE);
  const cmdPt = PT_COMANDO.test(texto);
  const cmdEs = ES_COMANDO.test(texto);

  let materia = questao.materia;
  let assunto = questao.assunto;
  let observacoes = questao.observacoes;

  const passagemIngles =
    detectarPassagemIngles(texto) && en > es * 2;
  const passagemEspanhol =
    es >= 6 &&
    es > pt &&
    es > en &&
    (cmdEs || !cmdPt) &&
    !textoIndicaPortugues(texto);

  if (passagemIngles && !pareceMateriaIngles(materia)) {
    materia = "Inglês";
    if (pareceMateriaPortugues(assunto) || assunto === "A classificar") {
      assunto = "Compreensão de texto";
    }
    observacoes =
      observacoes ?? "Texto-base em inglês com comando em português (padrão vestibular).";
  } else if (passagemEspanhol && !pareceMateriaEspanhol(materia)) {
    materia = "Espanhol";
    if (assunto === "A classificar" || pareceMateriaPortugues(assunto)) {
      assunto = "Compreensão de texto";
    }
    observacoes =
      observacoes ?? "Texto-base em espanhol com comando em português (padrão vestibular).";
  }

  const parcial = { ...questao, materia, assunto, observacoes };
  return ajustarClassificacaoPorConteudo(texto, parcial);
}

export function ajustarClassificacaoPorConteudo(
  textoQuestao: string,
  questao: QuestaoExtraida
): QuestaoExtraida {
  const texto = textoQuestao.trim();
  if (texto.length < 40) return normalizarMateriaMatematica(questao);

  const ptLit = forcarPortuguesLiteratura(texto, questao);
  if (ptLit) return normalizarMateriaMatematica(ptLit);

  let q = questao;
  if (!textoIndicaIngles(texto)) {
    q = ajustarPorConteudoDisciplinar(texto, q);
  }
  return normalizarMateriaMatematica(q);
}
