import type { ModoUsoRegistro, ProvaTipo } from "@/generated/prisma/client";
import {
  agruparUnidadesJornada,
  PROVA_SELECT_MULTIDIA,
  type ExamParaMultidia,
  type UnidadeRegistroJornada,
} from "@/lib/prova-multidia";
import { prisma } from "@/lib/prisma";
import { formatDataAplicacao } from "@/lib/data-prova";
import { pctAcertoRegistro } from "@/lib/exam-stats";
import {
  buildComparativoDuasExecucoes,
  type ComparativoVestibulares,
} from "@/lib/jornada-analytics";
import { type KpiExecucao, type PontoExecucao, serieKpiExecucoes, ultimoKpi } from "@/lib/kpi-evolucao";
import { labelModoUso, pesoModoUso } from "@/lib/modo-uso";

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
    tipo: ProvaTipo;
    totalQuestoes: number;
  };
  tentativas: TentativaProvaResumo[];
  evolucao: Array<{ data: string; taxaAcerto: number; nome: string }>;
  melhorPct: number | null;
  ultimaPct: number | null;
  tendencia: "subindo" | "estavel" | "caindo" | null;
  kpiSerie: KpiExecucao[];
  kpiUltima: KpiExecucao | null;
  comparativoTentativas: ComparativoVestibulares | null;
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
    include: { questionAttempts: { include: { provaQuestao: true } } },
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

  const pontos: PontoExecucao[] = tentativas.map((t, i) => ({
    id: exams[i]!.id,
    label: `Tentativa ${i + 1}`,
    dataLabel: t.dataLabel,
    pct: t.pctAcerto,
  }));
  const kpiSerie = serieKpiExecucoes(pontos);
  const kpiUltima = ultimoKpi(kpiSerie);
  const comparativoTentativas = buildComparativoDuasExecucoes(exams);

  return {
    prova,
    tentativas,
    evolucao,
    melhorPct,
    ultimaPct,
    tendencia,
    kpiSerie,
    kpiUltima,
    comparativoTentativas,
  };
}

const includeJornadaMultidia = {
  questionAttempts: { include: { provaQuestao: true } },
  prova: { select: PROVA_SELECT_MULTIDIA },
} as const;

/** Unidades recentes — dia 1 + dia 2 da mesma edição contam como um registro. */
export async function unidadesRecentesJornada(
  userId: string,
  limit = 8,
  excludeExamId?: string
): Promise<UnidadeRegistroJornada<ExamParaMultidia>[]> {
  const take = Math.max(limit * 2, 16);
  const exams = await prisma.exam.findMany({
    where: { userId },
    orderBy: { data: "desc" },
    take,
    include: includeJornadaMultidia,
  });

  let unidades = agruparUnidadesJornada(exams);
  if (excludeExamId) {
    unidades = unidades.filter((u) => !u.examIds.includes(excludeExamId));
  }
  return unidades.slice(0, limit);
}

/** @deprecated Prefer unidadesRecentesJornada — mantido para compatibilidade interna. */
export async function examsRecentesJornada(userId: string, limit = 8, excludeExamId?: string) {
  const unidades = await unidadesRecentesJornada(userId, limit, excludeExamId);
  return unidades.map((u) => ({
    ...u.exames[0]!,
    id: u.examIds[0]!,
    data: u.data,
    modoUso: u.modoUso,
    banca: u.banca,
    nome: u.nome,
    questionAttempts: u.questionAttempts,
  }));
}

export function pesoExam(exam: { modoUso: ModoUsoRegistro }) {
  return pesoModoUso(exam.modoUso);
}
