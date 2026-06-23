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

/** System prompt Linguagens v1.2 — roteamento já feito; classificar só na rota permitida. */
export function montarSystemClassificacaoLinguagensV12(
  catalog: MateriaCatalogo,
  rotaDisciplina: string
): string {
  const base = montarSystemClassificacaoV11(catalog);
  const roteamento = catalog.regras.roteamentoObrigatorio;
  const regraCritica =
    roteamento?.regraCritica ??
    "O comando em português NÃO define a rota. Classifique apenas escopos da rota já definida.";

  return (
    `${base}\n\n` +
    `LINGUAGENS — ROTA JÁ DEFINIDA: ${rotaDisciplina}\n` +
    `${regraCritica}\n` +
    `Não escolha escopos de outra disciplina/idioma. ` +
    `Gênero ou tema do texto não viram secundário se forem só contexto.`
  );
}

export function montarBlocoQuestaoV11(q: {
  fonteId: string;
  enunciado: string;
  alternativas: string;
  gabarito?: string | null;
}): string {
  const gab =
    q.gabarito?.trim() ?
      `Gabarito: ${q.gabarito.trim()}`
    : "Gabarito: (não informado)";
  return (
    `### ${q.fonteId}\n` +
    `Enunciado:\n${q.enunciado.slice(0, 2000)}\n\n` +
    `Alternativas:\n${q.alternativas.slice(0, 1500)}\n` +
    gab
  );
}
