import type { IdiomaVarianteQuestao, PoliticaIdiomasProva } from "@/generated/prisma/client";
import type { EstruturaProvaDetectada } from "@/lib/prova-pipeline-contexto";

export type FaixaIdiomaOpcional = { inicio: number; fim: number };

export type MetaPoliticaIdiomas = {
  politicaIdiomas?: PoliticaIdiomasProva | string;
  idiomaQuestaoInicio?: number | null;
  idiomaQuestaoFim?: number | null;
};

export type QuestaoComVariante = {
  numero: number;
  idiomaVariante?: IdiomaVarianteQuestao | string;
};

export function temDuplicataEnEs(meta?: MetaPoliticaIdiomas): boolean {
  return meta?.politicaIdiomas === "DUPLICATA_EN_ES";
}

export function faixaIdiomaProva(meta?: MetaPoliticaIdiomas): FaixaIdiomaOpcional | null {
  if (!temDuplicataEnEs(meta)) return null;
  const inicio = meta?.idiomaQuestaoInicio ?? 1;
  const fim = meta?.idiomaQuestaoFim ?? 5;
  if (!Number.isInteger(inicio) || !Number.isInteger(fim) || inicio < 1 || fim < inicio) {
    return { inicio: 1, fim: 5 };
  }
  return { inicio, fim };
}

export function numeroNaFaixaIdioma(numero: number, faixa: FaixaIdiomaOpcional): boolean {
  return numero >= faixa.inicio && numero <= faixa.fim;
}

export function chaveQuestaoVariante(numero: number, variante: IdiomaVarianteQuestao | string): string {
  return `${numero}:${variante}`;
}

/** Inferir faixa 1–5 (ou blocos EN/ES) a partir da leitura estrutural do PDF. */
export function inferirFaixaIdiomaDoPdf(estrutura: EstruturaProvaDetectada): FaixaIdiomaOpcional | null {
  if (estrutura.idiomas_estrangeiros !== "duplicata_ingles_espanhol") return null;

  const blocos = estrutura.blocos ?? [];
  const norm = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "");

  const blocoIng = blocos.find((b) => /ingles|ingl/.test(norm(b.titulo)));
  const blocoEsp = blocos.find((b) => /espanhol|espan/.test(norm(b.titulo)));

  if (blocoIng && blocoEsp) {
    const inicio = Math.max(blocoIng.questao_inicio, blocoEsp.questao_inicio);
    const fim = Math.min(blocoIng.questao_fim, blocoEsp.questao_fim);
    if (inicio > 0 && fim >= inicio) return { inicio, fim };
  }

  return { inicio: 1, fim: 5 };
}

export function varianteParaNumero(
  numero: number,
  meta: MetaPoliticaIdiomas,
  idiomaEstrangeiro?: IdiomaVarianteQuestao | null
): IdiomaVarianteQuestao {
  const faixa = faixaIdiomaProva(meta);
  if (faixa && numeroNaFaixaIdioma(numero, faixa)) {
    return idiomaEstrangeiro === "ESPANHOL" ? "ESPANHOL" : "INGLES";
  }
  return "COMUM";
}

/** Questões efetivas para correção / diagnóstico (uma por número lógico). */
export function questoesParaTentativa<
  T extends QuestaoComVariante & { id: string; materia: string; assunto: string; gabarito: string | null },
>(
  questoes: T[],
  meta: MetaPoliticaIdiomas,
  idiomaEstrangeiro?: IdiomaVarianteQuestao | null
): T[] {
  const faixa = faixaIdiomaProva(meta);
  const byKey = new Map(questoes.map((q) => [chaveQuestaoVariante(q.numero, q.idiomaVariante ?? "COMUM"), q]));

  const numeros = [...new Set(questoes.map((q) => q.numero))].sort((a, b) => a - b);

  const out: T[] = [];
  for (const numero of numeros) {
    const variante = varianteParaNumero(numero, meta, idiomaEstrangeiro);
    const q = byKey.get(chaveQuestaoVariante(numero, variante));
    if (q) {
      out.push(q);
      continue;
    }
    // Legado: prova sem variantes explícitas — uma linha COMUM por número
    const legado = byKey.get(chaveQuestaoVariante(numero, "COMUM"));
    if (legado) out.push(legado);
  }
  return out.sort((a, b) => a.numero - b.numero);
}

export function questaoPorNumeroETentativa<
  T extends QuestaoComVariante,
>(questoes: T[], numero: number, meta: MetaPoliticaIdiomas, idiomaEstrangeiro?: IdiomaVarianteQuestao | null): T | undefined {
  const variante = varianteParaNumero(numero, meta, idiomaEstrangeiro);
  return (
    questoes.find((q) => q.numero === numero && (q.idiomaVariante ?? "COMUM") === variante) ??
    questoes.find((q) => q.numero === numero && (q.idiomaVariante ?? "COMUM") === "COMUM")
  );
}

/** Linhas do banco exigidas para considerar a prova «completa» (admin). */
export function variantesExigidasPorNumero(
  numero: number,
  meta: MetaPoliticaIdiomas
): IdiomaVarianteQuestao[] {
  const faixa = faixaIdiomaProva(meta);
  if (faixa && numeroNaFaixaIdioma(numero, faixa)) {
    return ["INGLES", "ESPANHOL"];
  }
  return ["COMUM"];
}

export function labelVarianteQuestao(variante: IdiomaVarianteQuestao | string): string {
  if (variante === "INGLES") return "Inglês";
  if (variante === "ESPANHOL") return "Espanhol";
  return "";
}

export function labelIdiomaEstrangeiroEscolha(variante: IdiomaVarianteQuestao): string {
  return variante === "ESPANHOL" ? "Espanhol" : "Inglês";
}
