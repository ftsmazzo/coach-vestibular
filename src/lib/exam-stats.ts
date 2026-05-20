/** Percentual de acertos de um registro (Exam + tentativas). */
export function pctAcertoRegistro(questionAttempts: { correto: boolean }[]): number {
  const total = questionAttempts.length;
  if (total === 0) return 0;
  const acertos = questionAttempts.filter((q) => q.correto).length;
  return Math.round((acertos / total) * 100);
}
