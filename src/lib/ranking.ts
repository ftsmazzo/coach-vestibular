import { prisma } from "@/lib/prisma";

export interface RankingEntry {
  posicao: number;
  userId: string;
  nome: string;
  xp: number;
  sugestoesAceitas: number;
  ehVoce: boolean;
}

export interface RankingSnapshot {
  top: RankingEntry[];
  minhaPosicao: number | null;
  meuXp: number;
  meuNome: string;
  totalParticipantes: number;
}

function nomePublico(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 1) return parts[0] ?? "Aluno";
  return `${parts[0]} ${parts[1]![0]}.`;
}

export async function getRankingSnapshot(
  userId: string,
  limit = 15
): Promise<RankingSnapshot> {
  const students = await prisma.user.findMany({
    where: { role: "STUDENT" },
    select: {
      id: true,
      name: true,
      xp: true,
      _count: {
        select: {
          sugestoesClassificacao: { where: { status: "ACEITA" } },
        },
      },
    },
    orderBy: [{ xp: "desc" }, { name: "asc" }],
  });

  const ordenados = students
    .map((s) => ({
      userId: s.id,
      nome: nomePublico(s.name),
      xp: s.xp,
      sugestoesAceitas: s._count.sugestoesClassificacao,
    }))
    .sort((a, b) => b.xp - a.xp || a.nome.localeCompare(b.nome));

  const totalParticipantes = ordenados.length;
  const minhaPosicao =
    ordenados.findIndex((s) => s.userId === userId) >= 0
      ? ordenados.findIndex((s) => s.userId === userId) + 1
      : null;
  const eu = ordenados.find((s) => s.userId === userId);

  const top = ordenados.slice(0, limit).map((s, i) => ({
    posicao: i + 1,
    userId: s.userId,
    nome: s.nome,
    xp: s.xp,
    sugestoesAceitas: s.sugestoesAceitas,
    ehVoce: s.userId === userId,
  }));

  return {
    top,
    minhaPosicao,
    meuXp: eu?.xp ?? 0,
    meuNome: eu?.nome ?? "Você",
    totalParticipantes,
  };
}
