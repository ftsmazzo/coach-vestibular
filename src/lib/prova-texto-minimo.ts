/** Mínimo de caracteres esperado no texto da prova para extração confiável. */
export function minCaracteresTextoProva(totalQuestoes: number): number {
  const n = Math.max(1, totalQuestoes);
  return Math.max(1500, Math.min(n * 80, 400_000));
}

export function textoProvaPareceIncompleto(
  caracteres: number,
  totalQuestoes: number
): boolean {
  return caracteres < minCaracteresTextoProva(totalQuestoes);
}
