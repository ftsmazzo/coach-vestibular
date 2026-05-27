import { nomePublicoRanking } from "@/lib/apelido-ranking";
import { prisma } from "@/lib/prisma";

export interface RankingEntry {
  posicao: number;
  userId: string;
  /** Apelido anônimo — não mostra nome completo */
  apelido: string;
  xp: number;
  ehVoce: boolean;
}

export interface RankingSnapshot {
  top: RankingEntry[];
  minhaPosicao: number | null;
  meuXp: number;
  meuApelido: string;
  totalParticipantes: number;
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
      nomeExibicaoRanking: true,
      xp: true,
    },
    orderBy: [{ xp: "desc" }, { name: "asc" }],
  });

  const ordenados = students
    .map((s) => ({
      userId: s.id,
      apelido: nomePublicoRanking(s),
      xp: s.xp,
    }))
    .sort((a, b) => b.xp - a.xp || a.apelido.localeCompare(b.apelido));

  const totalParticipantes = ordenados.length;
  const idx = ordenados.findIndex((s) => s.userId === userId);
  const minhaPosicao = idx >= 0 ? idx + 1 : null;
  const eu = ordenados[idx];

  const top = ordenados.slice(0, limit).map((s, i) => ({
    posicao: i + 1,
    userId: s.userId,
    apelido: s.apelido,
    xp: s.xp,
    ehVoce: s.userId === userId,
  }));

  return {
    top,
    minhaPosicao,
    meuXp: eu?.xp ?? 0,
    meuApelido: eu ? (eu.userId === userId ? "Você" : eu.apelido) : "Você",
    totalParticipantes,
  };
}
