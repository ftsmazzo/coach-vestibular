import type { EscopoIndexEntry } from "@/lib/conhecimento-catalog/types";

export type IdiomaTrilhaLinguagens = "COMUM" | "ingles" | "espanhol";

/** Faixa de idioma estrangeiro opcional no caderno ENEM (dia 1). */
export const FAIXA_L2_ENEM = { inicio: 1, fim: 5 } as const;

export function naFaixaL2Enem(numero: number): boolean {
  return numero >= FAIXA_L2_ENEM.inicio && numero <= FAIXA_L2_ENEM.fim;
}

const MARCADORES_EN = [
  "the",
  "of",
  "and",
  "to",
  "with",
  "should",
  "would",
  "that",
  "this",
  "from",
  "their",
  "which",
];
const MARCADORES_ES = [
  "el",
  "la",
  "los",
  "las",
  "que",
  "para",
  "una",
  "porque",
  "según",
  "también",
  "del",
  "como",
  "está",
  "son",
];

function normTextoIdioma(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function contarMarcadoresIdioma(texto: string, marcadores: string[]): number {
  let n = 0;
  for (const m of marcadores) {
    const re = new RegExp(`\\b${m}\\b`, "g");
    const matches = texto.match(re);
    if (matches) n += matches.length;
  }
  if (texto.includes("¿") || texto.includes("¡")) n += 3;
  return n;
}

export type DeteccaoIdiomaTexto = {
  disciplina: "ingles" | "espanhol";
  confianca: number;
};

/** Idioma dominante no texto-base/enunciado/alternativas (ignora comando em PT). */
export function detectarIdiomaTextoQuestao(partes: {
  textoBase?: string;
  enunciado?: string;
  alternativas?: string;
}): DeteccaoIdiomaTexto | null {
  const texto = normTextoIdioma(
    [partes.textoBase, partes.enunciado, partes.alternativas].filter(Boolean).join(" ")
  );
  if (texto.length < 40) return null;

  const en = contarMarcadoresIdioma(texto, MARCADORES_EN);
  const es = contarMarcadoresIdioma(texto, MARCADORES_ES);

  if (en >= 4 && en > es * 1.5) {
    return { disciplina: "ingles", confianca: Math.min(0.92, 0.55 + en * 0.04) };
  }
  if (es >= 4 && es > en * 1.5) {
    return { disciplina: "espanhol", confianca: Math.min(0.92, 0.55 + es * 0.04) };
  }
  if (en >= 2 && es === 0) return { disciplina: "ingles", confianca: 0.72 };
  if (es >= 2 && en === 0) return { disciplina: "espanhol", confianca: 0.72 };

  return null;
}

/** Idioma persistido no corpus (campo EnemQuestaoCorpus.idioma). */
export function trilhaLinguagensPorIdioma(idioma: string | null | undefined): IdiomaTrilhaLinguagens {
  if (idioma === "ingles") return "ingles";
  if (idioma === "espanhol") return "espanhol";
  return "COMUM";
}

/**
 * Trilha efetiva para classificação/stats.
 *
 * Metadado explícito `ingles`/`espanhol` vence. Texto dominante EN/ES vence `idioma:COMUM`
 * e posição Q6+. `COMUM` sem texto L2 = bloco português (Q6+ por convenção ENEM).
 */
export function trilhaLinguagensEfetiva(
  idioma: string | null | undefined,
  numero?: number,
  texto?: string
): IdiomaTrilhaLinguagens {
  const porIdioma = trilhaLinguagensPorIdioma(idioma);
  if (porIdioma !== "COMUM") return porIdioma;

  const detectado = detectarIdiomaTextoQuestao({ enunciado: texto });
  if (detectado?.disciplina === "ingles") return "ingles";
  if (detectado?.disciplina === "espanhol") return "espanhol";

  if (numero != null && !naFaixaL2Enem(numero)) return "COMUM";

  return "COMUM";
}

/** Idioma para import/upsert — API + detecção no texto quando `language` é null/COMUM. */
export function inferirIdiomaCorpusLinguagens(
  _numero: number,
  language: "ingles" | "espanhol" | null,
  texto?: string | null
): "COMUM" | "ingles" | "espanhol" {
  if (language === "espanhol") return "espanhol";
  if (language === "ingles") return "ingles";
  const detectado = detectarIdiomaTextoQuestao({ enunciado: texto ?? undefined });
  if (detectado?.disciplina === "ingles") return "ingles";
  if (detectado?.disciplina === "espanhol") return "espanhol";
  return "COMUM";
}

/** Assuntos do catálogo elegíveis por trilha (prefixo no assuntoId). */
export function assuntoElegivelTrilha(assuntoId: string, trilha: IdiomaTrilhaLinguagens): boolean {
  if (trilha === "ingles") return assuntoId.startsWith("l2_en");
  if (trilha === "espanhol") return assuntoId.startsWith("l2_es");
  return assuntoId.startsWith("pt_");
}

export function filtrarEscoposLinguagens(
  escopos: Map<string, EscopoIndexEntry>,
  trilha: IdiomaTrilhaLinguagens
): Map<string, EscopoIndexEntry> {
  const out = new Map<string, EscopoIndexEntry>();
  for (const [id, entry] of escopos) {
    if (assuntoElegivelTrilha(entry.assuntoId, trilha)) {
      out.set(id, entry);
    }
  }
  return out;
}

export function rotuloTrilhaLinguagens(trilha: IdiomaTrilhaLinguagens): string {
  if (trilha === "ingles") return "Inglês (L2)";
  if (trilha === "espanhol") return "Espanhol (L2)";
  return "Português (bloco comum)";
}

export function instrucaoIaLinguagens(trilha: IdiomaTrilhaLinguagens): string {
  if (trilha === "ingles") {
    return (
      "Trilha INGLÊS (L2). Texto-base em inglês; comando pode estar em português. " +
      "Classifique a HABILIDADE de leitura (compreensão, inferência, vocabulário, coesão, propósito). " +
      "NUNCA escolha N2 de português, literatura brasileira ou gramática normativa PT."
    );
  }
  if (trilha === "espanhol") {
    return (
      "Trilha ESPANHOL (L2). Texto-base em espanhol; comando pode estar em português. " +
      "Classifique a HABILIDADE de leitura em L2. " +
      "NUNCA escolha N2 de português, literatura brasileira ou gramática normativa PT."
    );
  }
  return (
    "Trilha PORTUGUÊS (bloco comum ENEM, ~Q6–45). " +
    "Separe: interpretação/gêneros ≠ literatura (autor/período) ≠ gramática (regra explícita) ≠ artes/códigos. " +
    "NUNCA escolha N2 de inglês ou espanhol (L2)."
  );
}
