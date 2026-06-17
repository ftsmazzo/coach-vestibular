import type { ModoUsoRegistro } from "@/generated/prisma/client";
import { formatDataAplicacao } from "@/lib/data-prova";
import { prisma } from "@/lib/prisma";
import {
  normalizarNumeroMultidia,
  PROVA_SELECT_MULTIDIA,
  rotuloConjuntoCompleto,
} from "@/lib/prova-multidia";

export type ConjuntoExamView = {
  id: string;
  nome: string;
  banca: string | null;
  modoUso: ModoUsoRegistro;
  dataLabel: string;
  examIds: [string, string];
  provaIds: [string, string];
  totalQuestoes: number;
  acertos: number;
  questionAttempts: Array<{
    numero: number;
    correto: boolean;
    respostaAluno: string | null;
    materiaId: string | null;
    temaId: string | null;
    tipoErro: string | null;
    provaQuestaoId: string | null;
    provaQuestao: {
      materia: string;
      assunto: string;
      gabarito: string | null;
      conhecimentoExigido: string | null;
      nivelDificuldade: string | null;
    } | null;
  }>;
};

export async function loadConjuntoExamView(
  userId: string,
  examIdDia1: string,
  examIdDia2: string
): Promise<ConjuntoExamView | null> {
  const [e1, e2] = await Promise.all([
    prisma.exam.findFirst({
      where: { id: examIdDia1, userId },
      include: {
        questionAttempts: { include: { provaQuestao: true }, orderBy: { numero: "asc" } },
        prova: { select: PROVA_SELECT_MULTIDIA },
      },
    }),
    prisma.exam.findFirst({
      where: { id: examIdDia2, userId },
      include: {
        questionAttempts: { include: { provaQuestao: true }, orderBy: { numero: "asc" } },
        prova: { select: PROVA_SELECT_MULTIDIA },
      },
    }),
  ]);

  if (!e1?.prova || !e2?.prova) return null;

  const p1 = { ...e1.prova, dia: 1 as const };
  const p2 = { ...e2.prova, dia: 2 as const };
  const totalQuestoes = p1.totalQuestoes + p2.totalQuestoes;

  const questionAttempts = [
    ...e1.questionAttempts.map((a) => ({
      numero: normalizarNumeroMultidia(a.numero, p1),
      correto: a.correto,
      respostaAluno: a.respostaAluno,
      materiaId: a.materiaId,
      temaId: a.temaId,
      tipoErro: a.tipoErro,
      provaQuestaoId: a.provaQuestaoId,
      provaQuestao: a.provaQuestao,
    })),
    ...e2.questionAttempts.map((a) => ({
      numero: normalizarNumeroMultidia(a.numero, p2),
      correto: a.correto,
      respostaAluno: a.respostaAluno,
      materiaId: a.materiaId,
      temaId: a.temaId,
      tipoErro: a.tipoErro,
      provaQuestaoId: a.provaQuestaoId,
      provaQuestao: a.provaQuestao,
    })),
  ].sort((a, b) => a.numero - b.numero);

  const acertos = questionAttempts.filter((q) => q.correto).length;
  const data = e1.data > e2.data ? e1.data : e2.data;
  const modoUso =
    e1.modoUso === "OFICIAL" || e2.modoUso === "OFICIAL" ? "OFICIAL" : e1.modoUso;

  return {
    id: `conjunto~${examIdDia1}~${examIdDia2}`,
    nome: rotuloConjuntoCompleto(p1, totalQuestoes),
    banca: e1.banca ?? p1.banca,
    modoUso,
    dataLabel: formatDataAplicacao(data),
    examIds: [examIdDia1, examIdDia2],
    provaIds: [p1.id, p2.id],
    totalQuestoes: questionAttempts.length,
    acertos,
    questionAttempts,
  };
}
