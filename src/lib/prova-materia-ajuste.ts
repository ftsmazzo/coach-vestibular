import type { QuestaoExtraida } from "@/lib/ai-extract-prova";

const PT_COMANDO =
  /de acordo com o texto|segundo o texto|com base no texto|no texto acima|no fragmento|interpreta(?:ç|c)[aã]o do texto/i;

const ES_COMANDO =
  /de acuerdo con el texto|según el texto|segun el texto|con base en el texto/i;

/** Palavras muito comuns em passagens em inglês (não em PT). */
const RE_EN =
  /\b(the|and|of|to|in|is|are|was|were|with|for|that|this|from|have|has|had|been|every|year|can|will|would|their|they|them|you|your|we|our|as|at|by|or|an|be|if|it|its|not|but|all|one|people|who|when|what|which|there|these|those|such|than|then|into|over|after|before|between|about|through|during|without|within|against|among|pets|home|shelter)\b/gi;

const RE_ES =
  /\b(el|la|los|las|de|del|en|es|son|que|por|para|con|una|uno|como|más|pero|también|está|están|año|años|según|después|antes|entre|sobre|sin|desde|hasta|donde|cuando|todo|toda|todos|todas|este|esta|estos|estas|ese|esa|eso|aquí|allí|muy|puede|pueden|ser|hay|fue|fueron|tiene|tienen|hacer|hecho|vida|mundo|país|ciudad|gente|personas|niño|niños|perro|gato)\b/gi;

function contarMatches(texto: string, re: RegExp): number {
  return (texto.match(re) ?? []).length;
}

function pareceMateriaPortugues(materia: string): boolean {
  const m = materia.trim().toLowerCase();
  return (
    m.includes("portugu") ||
    m.includes("língua portuguesa") ||
    m.includes("lingua portuguesa") ||
    m === "lp" ||
    m.includes("interpretação de texto") && !m.includes("ingl")
  );
}

function pareceMateriaEspanhol(materia: string): boolean {
  const m = materia.trim().toLowerCase();
  return m.includes("espanhol") || m.includes("español") || m.includes("spanish");
}

function pareceMateriaIngles(materia: string): boolean {
  const m = materia.trim().toLowerCase();
  return m.includes("ingl") || m === "english" || m.includes("foreign");
}

/**
 * Vestibular: texto-base em língua estrangeira + pergunta em PT → matéria é a língua do texto-base.
 */
export function ajustarMateriaPorIdiomaDoTexto(
  textoQuestao: string,
  questao: QuestaoExtraida
): QuestaoExtraida {
  const texto = textoQuestao.trim();
  if (texto.length < 80) return questao;

  const en = contarMatches(texto, RE_EN);
  const es = contarMatches(texto, RE_ES);
  const cmdPt = PT_COMANDO.test(texto);
  const cmdEs = ES_COMANDO.test(texto);

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
      observacoes ??
      "Texto-base em inglês com comando em português (padrão vestibular).";
  } else if (passagemEspanhol && (cmdPt || cmdEs) && !pareceMateriaEspanhol(materia)) {
    materia = "Espanhol";
    if (assunto === "A classificar" || pareceMateriaPortugues(assunto)) {
      assunto = "Compreensão de texto em espanhol";
    }
    observacoes =
      observacoes ??
      "Texto-base em espanhol com comando em português (padrão vestibular).";
  }

  if (materia === questao.materia && assunto === questao.assunto) {
    return questao;
  }

  return { ...questao, materia, assunto, observacoes };
}
