export const rewardTemplates = {
  questComplete: [
    "Quest concluída. Isso é consistência — a mesma que vai te levar à medicina.",
    "Você cumpriu o combinado. Pequenos passos somam no vestibular.",
    "Mais um bloco feito. Orgulhe-se do processo, não só da nota.",
  ],
  streak: (days: number) =>
    `${days} dias seguidos registrando ou estudando. Ritmo importa mais que intensidade.`,
  improvement: (materia: string, pct: number) =>
    `Sua média em ${materia} subiu ${pct}% nos últimos simulados. Isso é progresso real.`,
  recovery: () =>
    "Modo recuperação ativo: metas menores, mesmo cuidado. Um simulado não define seu futuro.",
};

export function pickRewardMessage(key: keyof typeof rewardTemplates, ...args: number[]): string {
  if (key === "streak" && args[0]) return rewardTemplates.streak(args[0]);
  if (key === "improvement" && args.length >= 2) {
    return rewardTemplates.improvement(
      String(args[0]),
      args[1]
    );
  }
  if (key === "recovery") return rewardTemplates.recovery();
  const list = rewardTemplates.questComplete;
  return list[Math.floor(Math.random() * list.length)];
}

export const supportResources = `
Se você se sentir esgotada com frequência, conversar com alguém de confiança ou um profissional de saúde mental pode ajudar.
Este app apoia seus estudos — não substitui acompanhamento psicológico.
`.trim();
