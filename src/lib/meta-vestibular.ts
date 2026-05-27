/** Palavras-chave da meta do aluno → bancas que ganham peso extra na jornada/plano */
const META_PARA_BANCA: Array<{ bancas: string[]; keywords: string[] }> = [
  { bancas: ["ENEM"], keywords: ["enem"] },
  { bancas: ["UFU", "VESTIBULAR UFU"], keywords: ["ufu", "uberlandia", "uberlândia", "fuvest ufu"] },
  { bancas: ["UNICAMP", "COMVEST"], keywords: ["unicamp", "comvest"] },
  { bancas: ["USP", "FUVEST"], keywords: ["usp", "fuvest"] },
  { bancas: ["UNESP", "VUNESP"], keywords: ["unesp", "vunesp"] },
  { bancas: ["UNIFESP"], keywords: ["unifesp"] },
  { bancas: ["ITA"], keywords: ["ita"] },
  { bancas: ["FMUSP"], keywords: ["fmusp", "santos dumont"] },
];

export const PESO_BANCA_ALINHADA_META = 1.25;

function norm(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

/** Texto unificado da meta do aluno (curso + prova alvo). */
export function textoMetaAluno(metaProva?: string | null, vestibularAlvo?: string | null): string {
  return [vestibularAlvo, metaProva].filter(Boolean).join(" · ").trim();
}

/** Bancas que a meta do aluno sugere priorizar (rótulos internos). */
export function bancasPrioritariasDaMeta(
  metaProva?: string | null,
  vestibularAlvo?: string | null
): string[] {
  const meta = norm(textoMetaAluno(metaProva, vestibularAlvo));
  if (!meta) return [];

  const found = new Set<string>();
  for (const row of META_PARA_BANCA) {
    if (row.keywords.some((k) => meta.includes(norm(k)))) {
      row.bancas.forEach((b) => found.add(b));
    }
  }
  return [...found];
}

/** Multiplicador de peso quando a banca do registro alinha com a meta (ex.: meta "UFU 2026"). */
export function pesoBancaParaMeta(
  banca: string | null | undefined,
  metaProva?: string | null,
  vestibularAlvo?: string | null
): number {
  const b = norm(banca ?? "");
  if (!b) return 1;

  const meta = norm(textoMetaAluno(metaProva, vestibularAlvo));
  if (!meta) return 1;

  if (meta.includes(b) || b.split(/\s+/).some((part) => part.length > 2 && meta.includes(part))) {
    return PESO_BANCA_ALINHADA_META;
  }

  for (const row of META_PARA_BANCA) {
    const bancaMatch = row.bancas.some(
      (label) => b.includes(norm(label)) || norm(label).includes(b)
    );
    if (!bancaMatch) continue;
    if (row.keywords.some((k) => meta.includes(norm(k)))) {
      return PESO_BANCA_ALINHADA_META;
    }
  }

  return 1;
}

export function labelPesoMeta(banca: string | null | undefined, fator: number): string | null {
  if (fator <= 1) return null;
  return `Banca ${banca ?? ""} alinhada à sua meta (+${Math.round((fator - 1) * 100)}% no plano)`;
}
