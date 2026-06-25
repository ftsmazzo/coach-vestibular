import { prisma } from "@/lib/prisma";
import { calcularStreakRegistros } from "@/lib/streak";
import { getMateriaLabel } from "@/lib/taxonomy";
import { LABEL_TIPO_XP, XP_VALORES, type TipoXpEvento } from "@/lib/xp-valores";

export { LABEL_TIPO_XP, XP_VALORES, type TipoXpEvento };

/** Concede XP uma vez por (tipo + referência); retorna pontos ganhos ou 0. */
export async function concederXp(
  userId: string,
  tipo: TipoXpEvento,
  referencia: string,
  pontos?: number
): Promise<{ ganhou: number; mensagem?: string }> {
  const pts = pontos ?? XP_VALORES[tipo as keyof typeof XP_VALORES] ?? 0;
  if (pts <= 0) return { ganhou: 0 };

  try {
    await prisma.userXpEvent.create({
      data: { userId, tipo, referencia, pontos: pts },
    });
    await prisma.user.update({
      where: { id: userId },
      data: { xp: { increment: pts } },
    });
    const label = LABEL_TIPO_XP[tipo] ?? tipo;
    return { ganhou: pts, mensagem: `+${pts} XP — ${label}` };
  } catch {
    return { ganhou: 0 };
  }
}

export interface MateriaScoreLite {
  materiaId: string;
  taxaAcerto: number;
  erros?: number;
}

const MELHORIA_MIN_DELTA = 0.1;

/** Compara diagnóstico atual com o registro anterior; premia matérias com +10 p.p. de acerto. */
export async function concederXpMelhoriaMaterias(
  userId: string,
  examId: string,
  materiaScoresAtual: MateriaScoreLite[]
): Promise<string[]> {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    select: { data: true, provaId: true },
  });
  if (!exam) return [];

  const anterior = await prisma.exam.findFirst({
    where: {
      userId,
      id: { not: examId },
      ...(exam.provaId ? { provaId: exam.provaId } : {}),
    },
    orderBy: { data: "desc" },
    include: { diagnosticSnapshot: true },
  });

  if (!anterior?.diagnosticSnapshot) return [];

  let scoresAnt: MateriaScoreLite[] = [];
  try {
    const parsed = JSON.parse(anterior.diagnosticSnapshot.scoresJson) as {
      materiaScores?: MateriaScoreLite[];
      escopoScores?: Array<{ materiaId: string; acertos: number; erros: number; total: number }>;
    };
    if (parsed.materiaScores?.length) {
      scoresAnt = parsed.materiaScores;
    } else if (parsed.escopoScores?.length) {
      const map = new Map<string, { acertos: number; total: number }>();
      for (const s of parsed.escopoScores) {
        const m = map.get(s.materiaId) ?? { acertos: 0, total: 0 };
        m.total += s.total;
        m.acertos += s.acertos;
        map.set(s.materiaId, m);
      }
      scoresAnt = [...map.entries()].map(([materiaId, m]) => ({
        materiaId,
        taxaAcerto: m.total > 0 ? m.acertos / m.total : 0,
      }));
    }
  } catch {
    return [];
  }

  const mapAnt = new Map(scoresAnt.map((m) => [m.materiaId, m.taxaAcerto]));
  const mensagens: string[] = [];

  for (const atual of materiaScoresAtual) {
    const antes = mapAnt.get(atual.materiaId);
    if (antes == null) continue;
    const delta = atual.taxaAcerto - antes;
    if (delta < MELHORIA_MIN_DELTA) continue;
    if (atual.taxaAcerto < 0.35 && antes < 0.2) continue;

    const ref = `${examId}:${atual.materiaId}`;
    const { ganhou, mensagem } = await concederXp(
      userId,
      "MELHORIA_MATERIA",
      ref,
      XP_VALORES.MELHORIA_MATERIA
    );
    if (ganhou > 0) {
      const nome = getMateriaLabel(atual.materiaId);
      mensagens.push(
        mensagem ?? `+${ganhou} XP — você melhorou em ${nome} (+${Math.round(delta * 100)}%)`
      );
    }
  }

  return mensagens;
}

/** Se todas as quests práticas do plano atual estão done/skipped, +50 XP (uma vez por plano). */
export async function tentarXpQuestsSemana(userId: string): Promise<{ ganhou: number; mensagem?: string }> {
  const plan = await prisma.studyPlan.findFirst({
    where: { userId, escopo: "GLOBAL" },
    orderBy: { createdAt: "desc" },
  });
  if (!plan) return { ganhou: 0 };

  const items = JSON.parse(plan.itemsJson) as Array<{ titulo: string; geraQuest?: boolean; duracaoMin?: number }>;
  const titulosQuest = new Set(
    items
      .filter((i) => i.geraQuest !== false && (i.duracaoMin ?? 0) > 0)
      .map((i) => i.titulo)
  );
  if (titulosQuest.size === 0) return { ganhou: 0 };

  const quests = await prisma.quest.findMany({
    where: {
      userId,
      titulo: { in: [...titulosQuest] },
      createdAt: { gte: plan.createdAt },
    },
  });

  const relevantes = quests.filter((q) => titulosQuest.has(q.titulo));
  if (relevantes.length === 0) return { ganhou: 0 };

  const todasOk = relevantes.every((q) => q.status === "done" || q.status === "skipped");
  if (!todasOk) return { ganhou: 0 };

  return concederXp(userId, "QUESTS_SEMANA", plan.id, XP_VALORES.QUESTS_SEMANA);
}

function weekKey(d: Date): string {
  const x = new Date(d);
  const day = x.getDay();
  x.setDate(x.getDate() - day + (day === 0 ? -6 : 1));
  x.setHours(0, 0, 0, 0);
  return x.toISOString().slice(0, 10);
}

/** XP por primeiro registro na semana + marcos de streak. */
export async function concederXpRegistro(
  userId: string,
  examId: string,
  dataAplicacao: Date
): Promise<{ mensagens: string[] }> {
  const mensagens: string[] = [];
  const wk = weekKey(dataAplicacao);

  const countSemana = await prisma.exam.count({
    where: {
      userId,
      id: { not: examId },
      data: {
        gte: new Date(wk),
        lt: new Date(new Date(wk).getTime() + 7 * 86400000),
      },
    },
  });

  if (countSemana === 0) {
    const r = await concederXp(
      userId,
      "PRIMEIRO_REGISTRO_SEMANA",
      wk,
      XP_VALORES.PRIMEIRO_REGISTRO_SEMANA
    );
    if (r.ganhou > 0 && r.mensagem) mensagens.push(r.mensagem);
  }

  const exams = await prisma.exam.findMany({
    where: { userId },
    select: { createdAt: true },
  });
  const { streak } = calcularStreakRegistros(exams.map((e) => e.createdAt));

  if (streak >= 7) {
    const r = await concederXp(userId, "STREAK_7", `s${streak}`, XP_VALORES.STREAK_7);
    if (r.ganhou > 0 && r.mensagem) mensagens.push(r.mensagem);
  } else if (streak >= 3) {
    const r = await concederXp(userId, "STREAK_3", `s${streak}`, XP_VALORES.STREAK_3);
    if (r.ganhou > 0 && r.mensagem) mensagens.push(r.mensagem);
  }

  return { mensagens };
}

export async function ultimosEventosXp(userId: string, limit = 8) {
  return prisma.userXpEvent.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}
