import type { EscopoIndexEntry } from "@/lib/conhecimento-catalog/types";

export type IdiomaTrilhaLinguagens = "COMUM" | "ingles" | "espanhol";

/** Idioma estrutural do corpus ENEM (campo EnemQuestaoCorpus.idioma). */
export function trilhaLinguagensPorIdioma(idioma: string | null | undefined): IdiomaTrilhaLinguagens {
  if (idioma === "ingles") return "ingles";
  if (idioma === "espanhol") return "espanhol";
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
      "Trilha INGLÊS (questões 1–5 ENEM). Texto-base em inglês; comando pode estar em português. " +
      "Classifique a HABILIDADE de leitura (compreensão, inferência, vocabulário, coesão, propósito). " +
      "NUNCA escolha N2 de português, literatura brasileira ou gramática normativa PT."
    );
  }
  if (trilha === "espanhol") {
    return (
      "Trilha ESPANHOL (questões 1–5 ENEM). Texto-base em espanhol; comando pode estar em português. " +
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
