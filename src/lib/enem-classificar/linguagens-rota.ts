import type { EscopoIndexEntry } from "@/lib/conhecimento-catalog/types";

export type IdiomaTrilhaLinguagens = "COMUM" | "ingles" | "espanhol";

/** @deprecated Só import/sync ENEM — não usar em roteamento de classificação. */
export const FAIXA_L2_ENEM = { inicio: 1, fim: 5 } as const;

/** @deprecated Só import/sync ENEM — não usar em roteamento de classificação. */
export function naFaixaL2Enem(numero: number): boolean {
  return numero >= FAIXA_L2_ENEM.inicio && numero <= FAIXA_L2_ENEM.fim;
}

/** Idioma persistido no corpus (campo EnemQuestaoCorpus.idioma) — fonte enem.dev, sem heurística. */
export function trilhaLinguagensPorIdioma(idioma: string | null | undefined): IdiomaTrilhaLinguagens {
  if (idioma === "ingles") return "ingles";
  if (idioma === "espanhol") return "espanhol";
  return "COMUM";
}

/** Trilha efetiva para stats — idêntica ao campo `idioma` do corpus. */
export function trilhaLinguagensEfetiva(
  idioma: string | null | undefined,
  _numero?: number,
  _texto?: string
): IdiomaTrilhaLinguagens {
  return trilhaLinguagensPorIdioma(idioma);
}

/** Idioma para import/upsert — somente campo `language` da API enem.dev. */
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
    "Trilha PORTUGUÊS. " +
    "Separe: interpretação/gêneros ≠ literatura (autor/período) ≠ gramática (regra explícita) ≠ artes/códigos. " +
    "NUNCA escolha N2 de inglês ou espanhol (L2)."
  );
}
