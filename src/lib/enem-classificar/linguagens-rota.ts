import type { EscopoIndexEntry } from "@/lib/conhecimento-catalog/types";

export type IdiomaTrilhaLinguagens = "COMUM" | "ingles" | "espanhol";

/** Faixa de idioma estrangeiro opcional no caderno ENEM (dia 1). */
export const FAIXA_L2_ENEM = { inicio: 1, fim: 5 } as const;

export function naFaixaL2Enem(numero: number): boolean {
  return numero >= FAIXA_L2_ENEM.inicio && numero <= FAIXA_L2_ENEM.fim;
}

/** Marcadores predominantemente ingleses — pouco overlap com PT. */
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
  "have",
  "has",
  "been",
  "were",
  "was",
  "not",
  "they",
  "what",
  "when",
  "where",
  "how",
  "about",
  "into",
  "than",
  "them",
  "these",
  "those",
  "because",
  "however",
  "could",
  "people",
  "through",
  "after",
  "before",
  "other",
  "being",
  "while",
  "during",
];

/** Marcadores ES sem overlap forte com PT (NÃO usar que/para/como/del/porque). */
const MARCADORES_ES = [
  "el",
  "los",
  "las",
  "una",
  "unos",
  "unas",
  "según",
  "segun",
  "también",
  "tambien",
  "están",
  "estan",
  "había",
  "habia",
  "tienen",
  "tiene",
  "muy",
  "pero",
  "sus",
  "ese",
  "esa",
  "estos",
  "estas",
  "entre",
  "hacia",
  "desde",
];

/** Indícios fortes de português — vetam classificação como L2. */
const MARCADORES_PT = [
  "ção",
  "coes",
  "ções",
  "nh",
  "lh",
  "você",
  "voce",
  "não",
  "nao",
  "são",
  "sao",
  "estão",
  "estao",
  "português",
  "portugues",
  "brasil",
  "brasileir",
  "cujo",
  "cuja",
  "mesmas",
  "mesmos",
  "aquela",
  "aquele",
  "nossa",
  "nosso",
  "duas",
  "duis",
  "olhos",
  "mãos",
  "maos",
  "sobrancelhas",
  "editora",
  "lisboa",
  "antologia",
  "idade média",
  "idade media",
  "notícias",
  "noticias",
  "chuvas",
  "vestígios",
  "vestigios",
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
    if (m.includes(" ")) {
      if (texto.includes(m)) n += 2;
      continue;
    }
    const re = new RegExp(`\\b${m}\\b`, "g");
    const matches = texto.match(re);
    if (matches) n += matches.length;
  }
  return n;
}

export type DeteccaoIdiomaTexto = {
  disciplina: "ingles" | "espanhol";
  confianca: number;
};

export type DetectarIdiomaOpts = {
  /** Q6+ nunca vira espanhol por heurística; inglês só com sinal forte. */
  numero?: number;
};

/**
 * Heurística conservadora — evita confundir PT com ES (que/para/como são PT).
 * Espanhol só na faixa L2 (Q1–5). Inglês pode aparecer em Q6+ mal rotulado COMUM.
 */
export function detectarIdiomaTextoQuestao(
  partes: {
    textoBase?: string;
    enunciado?: string;
    alternativas?: string;
  },
  opts: DetectarIdiomaOpts = {}
): DeteccaoIdiomaTexto | null {
  const texto = normTextoIdioma(
    [partes.textoBase, partes.enunciado, partes.alternativas].filter(Boolean).join(" ")
  );
  if (texto.length < 40) return null;

  const pt = contarMarcadoresIdioma(texto, MARCADORES_PT);
  const en = contarMarcadoresIdioma(texto, MARCADORES_EN);
  let es = contarMarcadoresIdioma(texto, MARCADORES_ES);
  if (texto.includes("¿") || texto.includes("¡")) es += 3;
  if (/ñ/.test(texto)) es += 2;

  if (pt >= 2) return null;
  if (pt >= 1 && pt >= en && pt >= es) return null;

  const faixaL2 = opts.numero == null || naFaixaL2Enem(opts.numero);

  if (en >= 5 && en > es * 2) {
    return { disciplina: "ingles", confianca: Math.min(0.9, 0.6 + en * 0.03) };
  }
  if (en >= 3 && es === 0 && pt === 0 && en > es * 1.5) {
    return { disciplina: "ingles", confianca: 0.75 };
  }

  if (!faixaL2) return null;

  if (es >= 5 && es > en * 2 && pt === 0) {
    return { disciplina: "espanhol", confianca: Math.min(0.9, 0.6 + es * 0.03) };
  }
  if (es >= 3 && en === 0 && pt === 0) {
    return { disciplina: "espanhol", confianca: 0.72 };
  }

  return null;
}

/** Idioma persistido no corpus (campo EnemQuestaoCorpus.idioma). */
export function trilhaLinguagensPorIdioma(idioma: string | null | undefined): IdiomaTrilhaLinguagens {
  if (idioma === "ingles") return "ingles";
  if (idioma === "espanhol") return "espanhol";
  return "COMUM";
}

/**
 * Trilha efetiva para stats — confia no campo `idioma` (fonte enem.dev), sem heurística de texto.
 */
export function trilhaLinguagensEfetiva(
  idioma: string | null | undefined,
  _numero?: number,
  _texto?: string
): IdiomaTrilhaLinguagens {
  return trilhaLinguagensPorIdioma(idioma);
}

/** Idioma para import/upsert — somente campo `language` da API, sem heurística. */
export function inferirIdiomaCorpusLinguagens(
  _numero: number,
  language: "ingles" | "espanhol" | null,
  _texto?: string | null
): "COMUM" | "ingles" | "espanhol" {
  if (language === "espanhol") return "espanhol";
  if (language === "ingles") return "ingles";
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
