import type { DiagnosisResult, AttemptInput } from "@/lib/diagnosis";
import { buildDiagnosis, aplicarPlanoCoachIA } from "@/lib/diagnosis";
import { prisma } from "@/lib/prisma";
import { pesoBancaParaMeta } from "@/lib/meta-vestibular";
import { pesoModoUso } from "@/lib/modo-uso";
import { mapMateriaAssuntoToTaxonomy } from "@/lib/prova-catalog";
import { historicalAttemptsDaJornada } from "@/lib/jornada-plano";

function attemptsFromExam(
  exam: {
    questionAttempts: Array<{
      numero: number;
      correto: boolean;
      materiaId: string | null;
      temaId: string | null;
      tipoErro: string | null;
      provaQuestao?: { materia: string; assunto: string } | null;
    }>;
  }
): AttemptInput[] {
  return exam.questionAttempts.map((a) => {
    const mapped =
      a.provaQuestao &&
      mapMateriaAssuntoToTaxonomy(a.provaQuestao.materia, a.provaQuestao.assunto);
    return {
      numero: a.numero,
      correto: a.correto,
      materiaId: a.materiaId ?? mapped?.materiaId,
      temaId: a.temaId ?? mapped?.temaId,
      tipoErro: a.tipoErro as AttemptInput["tipoErro"],
    };
  });
}

/** Monta lista ponderada: cada questão entra N vezes conforme peso do registro (oficial pesa mais). */
export function attemptsPonderadosJornada(
  exams: Array<{
    modoUso: Parameters<typeof pesoModoUso>[0];
    banca: string | null;
    questionAttempts: Parameters<typeof attemptsFromExam>[0]["questionAttempts"];
  }>,
  metaProva?: string | null,
  vestibularAlvo?: string | null
): AttemptInput[] {
  const out: AttemptInput[] = [];
  for (const exam of exams) {
    const base = pesoModoUso(exam.modoUso) * pesoBancaParaMeta(exam.banca, metaProva, vestibularAlvo);
    const rep = Math.min(3, Math.max(1, Math.round(base)));
    const batch = attemptsFromExam(exam);
    for (let i = 0; i < rep; i++) out.push(...batch);
  }
  return out;
}

/** Diagnóstico para o plano global — agrega até 12 registros recentes. */
export async function buildDiagnosisFromJornada(userId: string): Promise<DiagnosisResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { metaProva: true, vestibularAlvo: true },
  });

  const exams = await prisma.exam.findMany({
    where: { userId },
    orderBy: { data: "desc" },
    take: 12,
    include: {
      questionAttempts: { include: { provaQuestao: true } },
      prova: { select: { tipo: true } },
    },
  });

  if (exams.length === 0) {
    return buildDiagnosis([], [], { examLabel: "sua jornada" });
  }

  const weighted = attemptsPonderadosJornada(
    exams,
    user?.metaProva,
    user?.vestibularAlvo
  );
  const historical = await historicalAttemptsDaJornada(userId);

  let diagnosis = await buildDiagnosis(weighted, historical, {
    examLabel: "sua jornada completa",
    modoUso: "OFICIAL",
  });

  diagnosis = {
    ...diagnosis,
    mensagem:
      `Plano baseado na sua jornada (${exams.length} registro${exams.length !== 1 ? "s" : ""}) — ` +
      `oficiais, simulados e listas entram com pesos diferentes. ` +
      diagnosis.mensagem,
  };

  return diagnosis;
}

/** Plano global: diagnóstico da jornada + IA; mantém resumo da última prova se existir. */
export async function buildPlanoGlobalFromJornada(
  userId: string,
  ultimoDiagnosis: DiagnosisResult,
  rawAttemptsUltimo: AttemptInput[]
) {
  const jornada = await buildDiagnosisFromJornada(userId);
  const merged: DiagnosisResult = {
    ...jornada,
    resumoProva: ultimoDiagnosis.resumoProva ?? jornada.resumoProva,
    recoveryMode: jornada.recoveryMode || ultimoDiagnosis.recoveryMode,
  };

  const attempts =
    rawAttemptsUltimo.length > 0 ? rawAttemptsUltimo : await weightedFallback(userId);

  return aplicarPlanoCoachIA(merged, attempts, {
    examLabel: "jornada + último registro",
  });
}

async function weightedFallback(userId: string): Promise<AttemptInput[]> {
  const exams = await prisma.exam.findMany({
    where: { userId },
    orderBy: { data: "desc" },
    take: 1,
    include: { questionAttempts: { include: { provaQuestao: true } } },
  });
  return exams[0] ? attemptsFromExam(exams[0]) : [];
}

/** Diagnóstico focado em uma prova do catálogo (tentativas do aluno naquela prova). */
export async function buildDiagnosisForProva(
  userId: string,
  provaId: string
): Promise<DiagnosisResult | null> {
  const exams = await prisma.exam.findMany({
    where: { userId, provaId },
    orderBy: { data: "desc" },
    include: {
      questionAttempts: { include: { provaQuestao: true } },
      prova: true,
    },
  });
  if (exams.length === 0) return null;

  const weighted = attemptsPonderadosJornada(exams);
  const historical = exams.slice(1).map((e) => attemptsFromExam(e));

  return buildDiagnosis(weighted, historical, {
    examLabel: exams[0]!.nome,
    provaTipo: exams[0]!.prova?.tipo,
    modoUso: exams[0]!.modoUso,
  });
}
