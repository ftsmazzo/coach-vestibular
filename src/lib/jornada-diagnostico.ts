import type { DiagnosisResult, AttemptInput } from "@/lib/diagnosis";
import { buildDiagnosis, aplicarPlanoCoachIA } from "@/lib/diagnosis";
import { prisma } from "@/lib/prisma";
import { pesoBancaParaMeta } from "@/lib/meta-vestibular";
import { pesoModoUso } from "@/lib/modo-uso";
import { mapMateriaAssuntoToTaxonomy } from "@/lib/prova-catalog";
import { historicalAttemptsDaJornada } from "@/lib/jornada-plano";
import {
  agruparUnidadesJornada,
  PROVA_SELECT_MULTIDIA,
} from "@/lib/prova-multidia";

type QuestionAttemptsJornada = Array<{
  numero: number;
  correto: boolean;
  materiaId: string | null;
  temaId: string | null;
  tipoErro: string | null;
  provaQuestao?: { materia: string; assunto: string } | null;
}>;

function attemptsFromExam(
  exam: {
    questionAttempts: QuestionAttemptsJornada;
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
    id?: string;
    modoUso: Parameters<typeof pesoModoUso>[0];
    banca: string | null;
    provaId?: string | null;
    prova?: Parameters<typeof agruparUnidadesJornada>[0][0]["prova"];
    questionAttempts: QuestionAttemptsJornada;
  }>,
  metaProva?: string | null,
  vestibularAlvo?: string | null
): AttemptInput[] {
  const unidades = agruparUnidadesJornada(
    exams.map((e, i) => ({
      id: e.id ?? e.provaId ?? `legacy-${i}`,
      data: new Date(0),
      modoUso: e.modoUso,
      banca: e.banca,
      nome: "",
      provaId: e.provaId ?? null,
      prova: e.prova ?? null,
      questionAttempts: e.questionAttempts,
    }))
  );
  return attemptsPonderadosUnidadesJornada(unidades, metaProva, vestibularAlvo);
}

export function attemptsPonderadosUnidadesJornada(
  unidades: Array<{
    modoUso: Parameters<typeof pesoModoUso>[0];
    banca: string | null;
    questionAttempts: QuestionAttemptsJornada;
  }>,
  metaProva?: string | null,
  vestibularAlvo?: string | null
): AttemptInput[] {
  const out: AttemptInput[] = [];
  for (const u of unidades) {
    const base = pesoModoUso(u.modoUso) * pesoBancaParaMeta(u.banca, metaProva, vestibularAlvo);
    const rep = Math.min(3, Math.max(1, Math.round(base)));
    const batch = attemptsFromExam({ questionAttempts: u.questionAttempts });
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
    take: 24,
    include: {
      questionAttempts: { include: { provaQuestao: true } },
      prova: { select: PROVA_SELECT_MULTIDIA },
    },
  });

  const unidades = agruparUnidadesJornada(exams).slice(0, 12);

  if (unidades.length === 0) {
    return buildDiagnosis([], [], { examLabel: "sua jornada" });
  }

  const weighted = attemptsPonderadosUnidadesJornada(
    unidades,
    user?.metaProva,
    user?.vestibularAlvo
  );
  const historical = await historicalAttemptsDaJornada(userId);

  const conjuntos = unidades.filter((u) => u.conjuntoMultidia).length;

  let diagnosis = await buildDiagnosis(weighted, historical, {
    examLabel: "sua jornada completa",
    modoUso: "OFICIAL",
  });

  diagnosis = {
    ...diagnosis,
    mensagem:
      `Plano baseado na sua jornada (${unidades.length} registro${unidades.length !== 1 ? "s" : ""}` +
      (conjuntos > 0 ? `, ${conjuntos} prova${conjuntos !== 1 ? "s" : ""} de 2 dias unificada${conjuntos !== 1 ? "s" : ""}` : "") +
      `) — oficiais, simulados e listas entram com pesos diferentes. ` +
      diagnosis.mensagem,
  };

  return diagnosis;
}

/** Plano global: diagnóstico da jornada + IA; mantém resumo da última prova se existir. */
export async function buildPlanoGlobalFromJornada(
  userId: string,
  ultimoDiagnosis: DiagnosisResult,
  rawAttemptsUltimo: AttemptInput[],
  options?: { planoSoJornada?: boolean }
) {
  const jornada = await buildDiagnosisFromJornada(userId);
  const merged: DiagnosisResult = {
    ...jornada,
    /** Plano global prioriza jornada inteira — não só o último registro (evita "4 provas" após excluir uma). */
    resumoProva: options?.planoSoJornada
      ? undefined
      : (ultimoDiagnosis.resumoProva ?? jornada.resumoProva),
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
