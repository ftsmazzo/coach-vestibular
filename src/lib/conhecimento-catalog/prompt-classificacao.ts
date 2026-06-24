import type { EscopoIndexEntry, MateriaCatalogo } from "./types";
import { idFallbackNaoClassificado } from "./load";

export type EscopoPromptReduzido = {
  id: string;
  label: string;
  assuntoId: string;
  descricao?: string;
  keywords: string[];
  keywordsContexto: string[];
  negativeHints?: string[];
  exemplosEnunciado: string[];
  naoConfundirCom: string[];
  regraDesempate?: string;
  conceitoCanonic?: string;
};

/** Payload mínimo de catálogo para a IA — sem changelog/notas/regras completas. */
export function montarCatalogoReduzido(
  escopos: Map<string, EscopoIndexEntry>
): EscopoPromptReduzido[] {
  return [...escopos.values()]
    .filter((e) => !e.ehFallback)
    .map((e) => ({
      id: e.escopoId,
      label: e.escopoLabel,
      assuntoId: e.assuntoId,
      ...(e.descricao ? { descricao: e.descricao } : {}),
      keywords: e.keywords,
      keywordsContexto: e.keywordsContexto,
      ...(e.negativeHints.length > 0 ? { negativeHints: e.negativeHints } : {}),
      exemplosEnunciado: e.exemplosEnunciado,
      naoConfundirCom: e.naoConfundirCom,
      ...(e.regraDesempate ? { regraDesempate: e.regraDesempate } : {}),
      ...(e.conceitoCanonic ? { conceitoCanonic: e.conceitoCanonic } : {}),
    }));
}

export function montarSystemClassificacaoV11(catalog: MateriaCatalogo): string {
  const regras = catalog.regras;
  const confMin = regras.confiancaMinima ?? 0.45;
  const fallbackId = idFallbackNaoClassificado(catalog.materiaId);
  const maxSec = regras.multiLabel?.maxSecundarios ?? 2;
  const politicaN3 =
    regras.politicaN3 ??
    "Em N3 (conhecimentoExigido) você PROPÕE texto livre — não escolhe ID do catálogo.";

  return (
    `Você é um classificador de questões de vestibular/ENEM em ${catalog.materiaLabel}. ` +
    `Sua tarefa é ler o ENUNCIADO + ALTERNATIVAS e mapear para escopos (N2) do catálogo fornecido.\n\n` +
    `REGRAS DE OURO\n` +
    `1. Você só escolhe IDs que existem no catálogo. Nunca invente IDs.\n` +
    `2. Classifique pelo CONHECIMENTO EXIGIDO para resolver a questão, não pelo tema do texto de apoio.\n` +
    `3. Use os campos de cada escopo nesta ordem de peso:\n` +
    `   - descricao → o que cobre E o que NÃO cobre\n` +
    `   - exemplosEnunciado → similaridade semântica\n` +
    `   - keywords (peso ${regras.pesos?.keywords ?? 1}) e keywordsContexto (peso ${regras.pesos?.keywordsContexto ?? 0.4})\n` +
    `   - negativeHints → se o enunciado contém o termo, este escopo provavelmente NÃO é o primário\n` +
    `   - naoConfundirCom + regraDesempate → desempate entre irmãos\n` +
    `4. Multi-label: 1 escopo PRIMÁRIO e até ${maxSec} SECUNDÁRIOS com confiança própria.\n` +
    `5. Se confiança do primário < ${confMin} OU empate irresolvível → primario.id = "${fallbackId}".\n` +
    `6. ${politicaN3}\n` +
    `7. Keyword sozinha NÃO basta — avalie o conceito testado na pergunta/alternativas.\n` +
    `8. Use o gabarito (quando fornecido) para calibrar o conhecimento exigido.\n\n` +
    `SAÍDA: JSON estrito no schema solicitado, sem markdown.`
  );
}

/** System prompt Linguagens v1.2 — rota + N2 numa única passagem IA (prova-agnóstico). */
export function montarSystemClassificacaoLinguagensV12(catalog: MateriaCatalogo): string {
  const base = montarSystemClassificacaoV11(catalog);
  const fallbackId = idFallbackNaoClassificado(catalog.materiaId);
  const confMin = catalog.regras.confiancaMinima ?? 0.45;

  return (
    `${base}\n\n` +
    `LINGUAGENS v1.2 — ROTEAMENTO + ESCOPO N2\n` +
    `Funciona para qualquer prova (ENEM, vestibular, PDF): não use posição fixa no caderno como regra.\n\n` +
    `REGRA ZERO — ROTEAMENTO OBRIGATÓRIO\n` +
    `Antes do escopo N2, defina rota.disciplinaOriginalId:\n` +
    `- portugues: PT, literatura, gramática, artes, tecnologias da linguagem.\n` +
    `- ingles: texto-base/competência de língua inglesa (comando pode estar em PT).\n` +
    `- espanhol: texto-base/competência de língua espanhola.\n` +
    `- indefinido: só se texto ilegível ou impossível decidir.\n\n` +
    `O comando em português NÃO define a rota. Metadados (idioma, numero, banca) são hints opcionais.\n` +
    `Decida pela língua dominante do TEXTO-BASE e pelo conhecimento cobrado.\n\n` +
    `ESCOPOS POR ROTA\n` +
    `- portugues: pt_interp, pt_lit, pt_gram, pt_sem, pt_art, pt_tec\n` +
    `- ingles: l2_en\n` +
    `- espanhol: l2_es\n\n` +
    `primario.id deve pertencer à rota escolhida. Se confiança < ${confMin} → primario.id = "${fallbackId}".\n` +
    `Gênero/tema do texto não vira secundário se for só contexto.`
  );
}

export function montarBlocoQuestaoV11(q: {
  fonteId: string;
  enunciado: string;
  alternativas: string;
  gabarito?: string | null;
  numero?: number;
  idioma?: string | null;
}): string {
  const gab =
    q.gabarito?.trim() ?
      `Gabarito: ${q.gabarito.trim()}`
    : "Gabarito: (não informado)";
  const meta =
    q.numero != null || q.idioma
      ? `Metadados: numero=${q.numero ?? "—"} idioma=${q.idioma ?? "COMUM"}\n`
      : "";
  return (
    `### ${q.fonteId}\n` +
    meta +
    `Enunciado:\n${q.enunciado}\n\n` +
    `Alternativas:\n${q.alternativas}\n` +
    gab
  );
}
