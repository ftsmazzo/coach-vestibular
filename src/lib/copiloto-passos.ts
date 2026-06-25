/**
 * Passos acionáveis compartilhados — plano semanal e quests por escopo.
 */
export function formatarPassos(passos: string[], porQue: string, duracaoMin: number): string {
  const lista = passos.map((p, i) => `${i + 1}. ${p}`).join("\n");
  return `Por que agora: ${porQue}\n\nO que fazer (~${duracaoMin} min):\n${lista}\n\nPronto quando: você tiver feito todos os passos e corrigido o que errou.`;
}
