export const PLACEHOLDER_REVISAO_IMAGEM = "[revisar: alternativa em imagem]";

export function questaoPrecisaRevisaoImagem(q: {
  alternativas?: string | null;
}): boolean {
  const alt = q.alternativas?.trim() ?? "";
  if (!alt) return false;
  return alt.includes(PLACEHOLDER_REVISAO_IMAGEM);
}

/** Números lógicos (ignora variante ES duplicada) com alternativas só-imagem. */
export function numerosLogicosRevisaoImagem(
  questoes: {
    numero: number;
    idiomaVariante?: string | null;
    alternativas?: string | null;
  }[]
): number[] {
  const nums = new Set<number>();
  for (const q of questoes) {
    if (q.idiomaVariante === "ESPANHOL") continue;
    if (questaoPrecisaRevisaoImagem(q)) nums.add(q.numero);
  }
  return [...nums].sort((a, b) => a - b);
}
