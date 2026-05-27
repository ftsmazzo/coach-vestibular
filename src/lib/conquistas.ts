import { prisma } from "@/lib/prisma";
import { XP_SUGESTAO_ACEITA } from "@/lib/xp-valores";

export interface Conquista {
  id: string;
  titulo: string;
  descricao: string;
  emoji: string;
  desbloqueada: boolean;
  progresso?: string;
}

export async function calcularConquistas(userId: string): Promise<Conquista[]> {
  const [user, totalExams, oficiais, sugestoesAceitas, questsSemanaXp, melhoriasXp] =
    await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { xp: true },
      }),
      prisma.exam.count({ where: { userId } }),
      prisma.exam.count({ where: { userId, modoUso: "OFICIAL" } }),
      prisma.sugestaoClassificacao.count({
        where: { userId, status: "ACEITA" },
      }),
      prisma.userXpEvent.count({ where: { userId, tipo: "QUESTS_SEMANA" } }),
      prisma.userXpEvent.count({ where: { userId, tipo: "MELHORIA_MATERIA" } }),
    ]);

  const xp = user?.xp ?? 0;

  const defs: Array<Omit<Conquista, "desbloqueada" | "progresso"> & {
    check: () => boolean;
    progresso?: () => string;
  }> = [
    {
      id: "primeiro_passo",
      titulo: "Primeiro passo",
      descricao: "Registrou o primeiro resultado de prova ou simulado.",
      emoji: "🎯",
      check: () => totalExams >= 1,
    },
    {
      id: "jornada_5",
      titulo: "Jornada em marcha",
      descricao: "Cinco registros na sua jornada.",
      emoji: "🛤️",
      check: () => totalExams >= 5,
      progresso: () => `${Math.min(totalExams, 5)}/5 registros`,
    },
    {
      id: "oficial_3",
      titulo: "Dia D",
      descricao: "Três registros em modo prova oficial.",
      emoji: "📋",
      check: () => oficiais >= 3,
      progresso: () => `${Math.min(oficiais, 3)}/3 oficiais`,
    },
    {
      id: "colaborador",
      titulo: "Colaborador",
      descricao: "Teve uma sugestão de classificação aceita pela equipe.",
      emoji: "🤝",
      check: () => sugestoesAceitas >= 1,
    },
    {
      id: "quests_semana",
      titulo: "Semana fechada",
      descricao: "Ganhou XP por concluir todas as quests do plano.",
      emoji: "✅",
      check: () => questsSemanaXp >= 1,
    },
    {
      id: "evoluiu_materia",
      titulo: "Evoluindo",
      descricao: "Ganhou XP por melhorar em alguma matéria entre registros.",
      emoji: "📈",
      check: () => melhoriasXp >= 1,
    },
    {
      id: "xp_25",
      titulo: "Estrela em ascensão",
      descricao: `Alcançou ${XP_SUGESTAO_ACEITA} XP ou mais.`,
      emoji: "⭐",
      check: () => xp >= XP_SUGESTAO_ACEITA,
      progresso: () => `${xp}/${XP_SUGESTAO_ACEITA} XP`,
    },
    {
      id: "xp_100",
      titulo: "Veterano da comunidade",
      descricao: "100 XP — referência para outros alunos.",
      emoji: "🏆",
      check: () => xp >= 100,
      progresso: () => `${xp}/100 XP`,
    },
  ];

  return defs.map((d) => ({
    id: d.id,
    titulo: d.titulo,
    descricao: d.descricao,
    emoji: d.emoji,
    desbloqueada: d.check(),
    progresso: !d.check() && d.progresso ? d.progresso() : undefined,
  }));
}
