import type { ModoUsoRegistro } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDataAplicacao } from "@/lib/data-prova";
import { labelModoUso, pesoModoUso } from "@/lib/modo-uso";
import { pctAcertoRegistro } from "@/lib/exam-stats";

export interface TentativaProvaResumo {
  examId: string;
  data: Date;
  dataLabel: string;
  pctAcerto: number;
  acertos: number;
  total: number;
  modoUso: ModoUsoRegistro;
  modoUsoLabel: string;
  recoveryMode: boolean;
}

export interface HistoricoProvaCatalogo {
  prova: {
    id: string;
    nome: string;
    banca: string;
    ano: number | null;
    tipo: string;
    totalQuestoes: number;
  };
  tentativas: TentativaProvaResumo[];
  evolucao: Array<{ data: string; taxaAcerto: number; nome: string }>;
  melhorPct: number | null;
  ultimaPct: number | null;
  tendencia: "subindo" | "estavel" | "caindo" | null;
}

export async function buildHistoricoProva(
  userId: string,
  provaId: string
): Promise<HistoricoProvaCatalogo | null> {
  const prova = await prisma.prova.findFirst({
    where: { id: provaId, publicada: true },
    select: {
      id: true,
      nome: true,
      banca: true,
      ano: true,
      tipo: true,
      totalQuestoes: true,
    },
  });
  if (!prova) return null;

  const exams = await prisma.exam.findMany({
    where: { userId, provaId },
    orderBy: { data: "asc" },
    include: { questionAttempts: true },
  });

  const tentativas: TentativaProvaResumo[] = exams.map((e) => {
    const total = e.questionAttempts.length;
    const acertos = e.questionAttempts.filter((q) => q.correto).length;
    return {
      examId: e.id,
      data: e.data,
      dataLabel: formatDataAplicacao(e.data),
      pctAcerto: pctAcertoRegistro(e.questionAttempts),
      acertos,
      total,
      modoUso: e.modoUso,
      modoUsoLabel: labelModoUso(e.modoUso),
      recoveryMode: e.recoveryMode,
    };
  });

  const evolucao = tentativas.map((t) => ({
    data: t.dataLabel,
    taxaAcerto: t.pctAcerto,
    nome: prova.nome,
  }));

  const pcts = tentativas.map((t) => t.pctAcerto);
  const melhorPct = pcts.length ? Math.max(...pcts) : null;
  const ultimaPct = pcts.length ? pcts[pcts.length - 1]! : null;

  let tendencia: HistoricoProvaCatalogo["tendencia"] = null;
  if (pcts.length >= 2) {
    const penultimo = pcts[pcts.length - 2]!;
    const ultimo = pcts[pcts.length - 1]!;
    if (ultimo > penultimo + 3) tendencia = "subindo";
    else if (ultimo < penultimo - 3) tendencia = "caindo";
    else tendencia = "estavel";
  }

  return {
    prova,
    tentativas,
    evolucao,
    melhorPct,
    ultimaPct,
    tendencia,
  };
}

/** Exams recentes de toda a jornada (para recorrência no diagnóstico). */
export async function examsRecentesJornada(userId: string, limit = 8, excludeExamId?: string) {
  return prisma.exam.findMany({
    where: {
      userId,
      ...(excludeExamId ? { id: { not: excludeExamId } } : {}),
    },
    orderBy: { data: "desc" },
    take: limit,
    include: {
      questionAttempts: { include: { provaQuestao: true } },
    },
  });
}

export function pesoExam(exam: { modoUso: ModoUsoRegistro }) {
  return pesoModoUso(exam.modoUso);
}
