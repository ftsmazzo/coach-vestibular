import type { ErrorType } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { buildDiagnosis, type AttemptInput } from "./diagnosis";
import { generateStudyPlan, planToQuests } from "./study-plan";
import { mapMateriaAssuntoToTaxonomy, syncProvaGabaritoStatus } from "./prova-catalog";
import { normalizarAlternativas } from "./gabarito";

export interface RegistrarTentativaInput {
  userId: string;
  provaId: string;
  data?: string;
  checkInScore?: number;
  nota?: number;
  /** Sequência de respostas A–E na ordem das questões */
  respostas?: string;
  /** Apenas números das questões erradas (resto = acerto se tiver gabarito implícito) */
  apenasErros?: number[];
}

function buildAttemptsFromProva(
  questoes: Array<{
    id: string;
    numero: number;
    materia: string;
    assunto: string;
    gabarito: string | null;
  }>,
  respostasNorm: string,
  apenasErros?: number[]
): AttemptWithMeta[] {
  const erroSet = apenasErros ? new Set(apenasErros) : null;

  return questoes.map((q, i) => {
    const respostaAluno = respostasNorm[i]?.toUpperCase();
    let correto = false;

    if (erroSet) {
      correto = !erroSet.has(q.numero);
    } else if (q.gabarito && respostaAluno) {
      correto = q.gabarito.toUpperCase() === respostaAluno;
    } else if (respostaAluno && !q.gabarito) {
      correto = false;
    } else {
      correto = true;
    }

    const { materiaId, temaId } = mapMateriaAssuntoToTaxonomy(q.materia, q.assunto);

    return {
      numero: q.numero,
      correto,
      materiaId: materiaId ?? undefined,
      temaId: temaId ?? undefined,
      tipoErro: undefined,
      provaQuestaoId: q.id,
      respostaAluno: respostaAluno || undefined,
    };
  });
}

type AttemptWithMeta = AttemptInput & {
  provaQuestaoId?: string;
  respostaAluno?: string;
};

export async function registrarTentativaProva(input: RegistrarTentativaInput) {
  const prova = await prisma.prova.findUnique({
    where: { id: input.provaId },
    include: { questoes: { orderBy: { numero: "asc" } } },
  });

  if (!prova) throw new Error("PROVA_NOT_FOUND");
  if (!prova.publicada) throw new Error("PROVA_NOT_PUBLISHED");
  if (prova.questoes.length === 0) throw new Error("PROVA_EMPTY");

  const respostasNorm = input.respostas ? normalizarAlternativas(input.respostas) : "";
  const rawAttempts = buildAttemptsFromProva(
    prova.questoes,
    respostasNorm,
    input.apenasErros
  );

  const historicalExams = await prisma.exam.findMany({
    where: { userId: input.userId, provaId: prova.id },
    orderBy: { data: "desc" },
    take: 5,
    include: {
      questionAttempts: {
        include: { provaQuestao: true },
      },
    },
  });

  const historicalAttempts: AttemptInput[][] = historicalExams.map((e) =>
    e.questionAttempts.map((a) => {
      const mapped =
        a.provaQuestao &&
        mapMateriaAssuntoToTaxonomy(a.provaQuestao.materia, a.provaQuestao.assunto);
      return {
        numero: a.numero,
        correto: a.correto,
        materiaId: a.materiaId ?? mapped?.materiaId,
        temaId: a.temaId ?? mapped?.temaId,
        tipoErro: a.tipoErro,
      };
    })
  );

  const diagnosis = buildDiagnosis(
    rawAttempts.map(({ numero, correto, materiaId, temaId, tipoErro }) => ({
      numero,
      correto,
      materiaId,
      temaId,
      tipoErro: tipoErro as ErrorType | null | undefined,
    })),
    historicalAttempts,
    { checkInScore: input.checkInScore }
  );

  const exam = await prisma.exam.create({
    data: {
      userId: input.userId,
      provaId: prova.id,
      nome: prova.nome,
      data: input.data ? new Date(input.data) : new Date(),
      banca: prova.banca,
      totalQuestoes: prova.totalQuestoes,
      nota: input.nota,
      checkInScore: input.checkInScore,
      recoveryMode: diagnosis.recoveryMode,
      questionAttempts: {
        create: rawAttempts.map((a) => {
          const q = prova.questoes.find((pq) => pq.numero === a.numero)!;
          const { materiaId, temaId } = mapMateriaAssuntoToTaxonomy(q.materia, q.assunto);
          const ext = a as AttemptWithMeta;
          return {
            numero: a.numero,
            correto: a.correto,
            provaQuestaoId: q.id,
            respostaAluno: ext.respostaAluno ?? null,
            materiaId,
            temaId,
            tipoErro: a.tipoErro,
          };
        }),
      },
      diagnosticSnapshot: {
        create: {
          userId: input.userId,
          scoresJson: JSON.stringify({
            overallAcerto: diagnosis.overallAcerto,
            materiaScores: diagnosis.materiaScores,
            temaScores: diagnosis.temaScores,
            provaId: prova.id,
          }),
          focosJson: JSON.stringify(diagnosis.focos),
          mensagem: diagnosis.mensagem,
          recoveryMode: diagnosis.recoveryMode,
        },
      },
      ...(input.checkInScore
        ? { emotionalLog: { create: { userId: input.userId, score: input.checkInScore } } }
        : {}),
    },
    include: { diagnosticSnapshot: true },
  });

  const { items, recoveryMode } = generateStudyPlan(diagnosis);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);

  await prisma.studyPlan.create({
    data: {
      userId: input.userId,
      weekStart,
      itemsJson: JSON.stringify(items),
      recoveryMode,
    },
  });

  await prisma.quest.createMany({ data: planToQuests(items, input.userId) });

  return { exam, diagnosis, prova };
}

export async function refreshProvaGabaritoFlag(provaId: string) {
  const questoes = await prisma.provaQuestao.findMany({ where: { provaId } });
  const completo = syncProvaGabaritoStatus(questoes);
  await prisma.prova.update({
    where: { id: provaId },
    data: { gabaritoCompleto: completo },
  });
  return completo;
}
