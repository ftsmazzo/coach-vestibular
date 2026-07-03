/**
 * Pré-classificação N2 por keywords do catálogo — usa a estrutura rica (keywords, negativeHints, descricao).
 * Fast-path quando o match é inequívoco; caso contrário a IA decide.
 */

import type { EscopoIndexEntry, ResultadoClassificacao } from "@/lib/conhecimento-catalog/types";

export type EscopoKeywordsScore = {
  escopoId: string;
  score: number;
  hitsKeywords: number;
  hitsContexto: number;
  hitsNegative: number;
};

const CONFIANCA_FAST_PATH = 0.82;
const MARGEM_MINIMA = 1.4;
const SCORE_MINIMO = 2.2;

function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

function escRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function termoNoTexto(textoNorm: string, termo: string): boolean {
  const t = norm(termo);
  if (t.length < 3) return false;
  if (t.includes(" ")) return textoNorm.includes(t);
  return new RegExp(`\\b${escRegex(t)}\\b`).test(textoNorm);
}

/** Pontua escopos do catálogo contra o texto da questão. */
export function pontuarEscoposPorConteudo(
  texto: string,
  escopos: Map<string, EscopoIndexEntry>,
  pesos?: { keywords?: number; keywordsContexto?: number; negative?: number }
): EscopoKeywordsScore[] {
  const textoNorm = norm(texto);
  if (textoNorm.length < 20) return [];

  const wKw = pesos?.keywords ?? 1;
  const wCtx = pesos?.keywordsContexto ?? 0.45;
  const wNeg = pesos?.negative ?? 1.2;

  const scores: EscopoKeywordsScore[] = [];

  for (const entry of escopos.values()) {
    if (entry.ehFallback || entry.deprecated) continue;

    let hitsKeywords = 0;
    let hitsContexto = 0;
    let hitsNegative = 0;

    for (const kw of entry.keywords) {
      if (termoNoTexto(textoNorm, kw)) hitsKeywords++;
    }
    for (const kw of entry.keywordsContexto) {
      if (termoNoTexto(textoNorm, kw)) hitsContexto++;
    }
    for (const neg of entry.negativeHints) {
      if (termoNoTexto(textoNorm, neg)) hitsNegative++;
    }

    const score = hitsKeywords * wKw + hitsContexto * wCtx - hitsNegative * wNeg;
    if (score > 0 || hitsKeywords > 0) {
      scores.push({
        escopoId: entry.escopoId,
        score,
        hitsKeywords,
        hitsContexto,
        hitsNegative,
      });
    }
  }

  return scores.sort((a, b) => b.score - a.score);
}

/** Tenta escolher escopo só por keywords — retorna null se empate ou confiança baixa. */
export function tentarEscopoPorKeywords(
  texto: string,
  escopos: Map<string, EscopoIndexEntry>
): { escopoId: string; confianca: number; motivo: string } | null {
  const ranked = pontuarEscoposPorConteudo(texto, escopos);
  if (ranked.length === 0) return null;

  const best = ranked[0]!;
  const second = ranked[1]?.score ?? 0;

  if (best.score < SCORE_MINIMO) return null;
  if (best.hitsNegative > 0) return null;
  if (second > 0 && best.score < second * MARGEM_MINIMA) return null;

  const confianca = Math.min(
    0.94,
    CONFIANCA_FAST_PATH + best.hitsKeywords * 0.03 + (best.score - second) * 0.04
  );
  if (confianca < CONFIANCA_FAST_PATH) return null;

  return {
    escopoId: best.escopoId,
    confianca,
    motivo: `keywords catálogo (${best.hitsKeywords} kw, ${best.hitsContexto} ctx, score=${best.score.toFixed(1)})`,
  };
}

export function resultadoFromEscopoKeywords(
  match: { escopoId: string; confianca: number; motivo: string },
  escopos: Map<string, EscopoIndexEntry>,
  materiaId: string,
  fallbackId: string
): ResultadoClassificacao {
  const entry = escopos.get(match.escopoId);
  if (!entry) {
    return {
      status: "review",
      confianca: 0,
      materiaId,
      assuntoId: null,
      dominioId: null,
      escopoId: fallbackId,
      conceitoCanonic: null,
      motivo: "Escopo keywords inválido.",
      sinalizadorRevisao: true,
      conhecimentoExigido: null,
    };
  }

  return {
    status: match.confianca >= 0.88 ? "classified" : "review",
    confianca: match.confianca,
    materiaId: entry.materiaId ?? materiaId,
    assuntoId: entry.assuntoId,
    dominioId: entry.dominioId,
    escopoId: entry.escopoId,
    conceitoCanonic: entry.conceitoCanonic ?? null,
    motivo: match.motivo,
    sinalizadorRevisao: match.confianca < 0.88,
    conhecimentoExigido: null,
  };
}
