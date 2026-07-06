/**
 * Pós-validação determinística da saída da IA no N2.
 * Usa negativeHints e score por keywords do catálogo.
 */

import {
  pontuarEscoposPorConteudo,
  type EscopoKeywordsScore,
} from "@/lib/enem-classificar/escopo-por-keywords";
import type { EscopoIndexEntry, ResultadoClassificacao } from "@/lib/conhecimento-catalog/types";

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

function termoNoTexto(textoNorm: string, termo: string): boolean {
  const t = norm(termo);
  if (t.length < 3) return false;
  if (t.includes(" ")) return textoNorm.includes(t);
  return new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(textoNorm);
}

function negativeHintsViolados(
  texto: string,
  entry: EscopoIndexEntry | undefined
): string[] {
  if (!entry?.negativeHints.length) return [];
  const t = norm(texto);
  return entry.negativeHints.filter((neg) => termoNoTexto(t, neg));
}

function scoreDoEscopo(
  escopoId: string | null | undefined,
  ranked: EscopoKeywordsScore[]
): number {
  if (!escopoId) return 0;
  return ranked.find((r) => r.escopoId === escopoId)?.score ?? 0;
}

const ESCALA_CARTografica = "geo.cartografia.representacao.escala_cartografica";
const SIMBOLOS_CARTograficos = "geo.cartografia.representacao.simbolos_cartograficos";

const INDICADORES_SIMBOLOS_CARTograficos = [
  "simbolos cartograficos",
  "símbolos cartográficos",
  "linguagem cartografica",
  "linguagem cartográfica",
  "semiologia cartografica",
  "semiologia cartográfica",
  "semiologia grafica",
  "semiologia gráfica",
  "uso dos simbolos cartograficos",
  "uso dos símbolos cartográficos",
  "variaveis visuais",
  "variáveis visuais",
  "legenda cartografica",
  "legenda cartográfica",
  "pontos linhas areas",
  "pontos linhas áreas",
  "relacoes de diversidade",
  "relações de diversidade",
  "relacoes de ordem",
  "relações de ordem",
  "relacoes de proporcionalidade",
  "relações de proporcionalidade",
];

function textoIndicaSimbolosCartograficos(texto: string): boolean {
  const t = norm(texto);
  const termos = [
    ...INDICADORES_SIMBOLOS_CARTograficos,
    "pontos",
    "linhas",
    "areas",
    "diversidade",
    "ordem",
    "proporcionalidade",
  ];
  return termos.some((termo) => termoNoTexto(t, termo));
}

function corrigirEscalaParaSimbolosCartograficos(
  texto: string,
  resultado: ResultadoClassificacao,
  escopos: Map<string, EscopoIndexEntry>
): ResultadoClassificacao {
  if (resultado.escopoId !== ESCALA_CARTografica) return resultado;
  if (!textoIndicaSimbolosCartograficos(texto)) return resultado;

  const altEntry = escopos.get(SIMBOLOS_CARTograficos);
  if (!altEntry) return resultado;

  return {
    ...resultado,
    escopoId: SIMBOLOS_CARTograficos,
    assuntoId: altEntry.assuntoId,
    dominioId: altEntry.dominioId,
    conceitoCanonic: altEntry.conceitoCanonic ?? null,
    status: "review",
    sinalizadorRevisao: true,
    motivo: `pos-ia: escala_cartografica → simbolos_cartograficos (símbolos/pontos/linhas/áreas no enunciado)`,
  };
}

/** Corrige ou sinaliza escopo N2 após IA usando metadados do catálogo. */
export function validarEscopoPosIA(
  texto: string,
  resultado: ResultadoClassificacao,
  escopos: Map<string, EscopoIndexEntry>,
  fallbackId: string,
  confiancaMinima: number
): ResultadoClassificacao {
  const escopoId = resultado.escopoId;
  if (!escopoId || escopoId === fallbackId) return resultado;

  const entry = escopos.get(escopoId);
  const neg = negativeHintsViolados(texto, entry);
  const ranked = pontuarEscoposPorConteudo(texto, escopos);
  const scoreIa = scoreDoEscopo(escopoId, ranked);
  const best = ranked[0];

  if (neg.length > 0) {
    const alternativa =
      ranked.find((r) => r.escopoId !== escopoId && r.hitsNegative === 0) ?? null;
    if (alternativa && alternativa.score >= scoreIa * 1.2) {
      const altEntry = escopos.get(alternativa.escopoId)!;
      return corrigirEscalaParaSimbolosCartograficos(texto, {
        ...resultado,
        escopoId: alternativa.escopoId,
        assuntoId: altEntry.assuntoId,
        dominioId: altEntry.dominioId,
        conceitoCanonic: altEntry.conceitoCanonic ?? null,
        confianca: Math.min(resultado.confianca ?? 0.7, alternativa.score / 5),
        status: "review",
        sinalizadorRevisao: true,
        motivo: `pos-ia: negativeHints [${neg.join(", ")}] — trocado para ${alternativa.escopoId}`,
      }, escopos);
    }
    return corrigirEscalaParaSimbolosCartograficos(texto, {
      ...resultado,
      status: "review",
      sinalizadorRevisao: true,
      motivo: `${resultado.motivo ?? ""} | negativeHints: ${neg.join(", ")}`.trim(),
    }, escopos);
  }

  if (best && best.escopoId !== escopoId && best.score >= scoreIa * 2 && best.hitsNegative === 0) {
    const altEntry = escopos.get(best.escopoId)!;
    return corrigirEscalaParaSimbolosCartograficos(texto, {
      ...resultado,
      escopoId: best.escopoId,
      assuntoId: altEntry.assuntoId,
      dominioId: altEntry.dominioId,
      conceitoCanonic: altEntry.conceitoCanonic ?? null,
      confianca: Math.max(confiancaMinima, Math.min(0.85, best.score / 4)),
      status: "review",
      sinalizadorRevisao: true,
      motivo: `pos-ia: keywords favorecem ${best.escopoId} (score ${best.score.toFixed(1)} vs ${scoreIa.toFixed(1)})`,
    }, escopos);
  }

  return corrigirEscalaParaSimbolosCartograficos(texto, resultado, escopos);
}
