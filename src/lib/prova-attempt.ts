import type { ErrorType } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { buildDiagnosis, type AttemptInput } from "./diagnosis";
import { generateStudyPlan, planToQuests } from "./study-plan";
import { mapMateriaAssuntoToTaxonomy, syncProvaGabaritoStatus } from "./prova-catalog";
import { parseGabaritoLote, sequenciaParaMapaPorNumero } from "./gabarito";

export interface RegistrarTentativaInput {
  userId: string;
  provaId: string;
  data?: string;
  checkInScore?: number;
  nota?: number;
  /** Linhas número,letra — gabarito do aluno (recomendado) */
  gabaritoAluno?: string;
  /** Sequência de respostas A–E na ordem das questões cadastradas */
  respostas?: string;
  /** Só números errados — análise parcial se não houver gabarito do aluno */
  apenasErros?: number[];
}

type AttemptWithMeta = AttemptInput & {
  provaQuestaoId?: string;
  respostaAluno?: string;
};

function buildAttemptsFromProva(
  questoes: Array<{
    id: string;
    numero: number;
    materia: string;
    assunto: string;
    gabarito: string | null;
  }>,
  respostasPorNumero: Map<number, string>,
  apenasErros?: number[]
): { attempts: AttemptWithMeta[]; analiseCompleta: boolean; avisos: string[] } {
  const erroSet = apenasErros ? new Set(apenasErros) : null;
  const avisos: string[] = [];
  let comRespostaAluno = 0;
  let comparadosComOficial = 0;
  let errosConfirmados = 0;

  const modoGabaritoAluno = respostasPorNumero.size > 0;

  const attempts = questoes
    .map((q) => {
      const respostaAluno = respostasPorNumero.get(q.numero)?.toUpperCase();

      if (modoGabaritoAluno && !respostaAluno && !erroSet?.has(q.numero)) {
        return null;
      }

      if (respostaAluno) comRespostaAluno++;

      let correto = false;

      if (respostaAluno && q.gabarito) {
        correto = q.gabarito.toUpperCase() === respostaAluno;
        comparadosComOficial++;
        if (!correto) errosConfirmados++;
      } else if (respostaAluno && !q.gabarito && erroSet) {
        correto = !erroSet.has(q.numero);
        if (!correto) errosConfirmados++;
      } else if (erroSet) {
        correto = !erroSet.has(q.numero);
        if (!correto) errosConfirmados++;
      } else if (respostaAluno) {
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
        respostaAluno,
      };
    })
    .filter((a): a is AttemptWithMeta => a != null);

  const gabaritoOficialCount = questoes.filter((q) => q.gabarito).length;
  const analiseCompleta = comRespostaAluno > 0 || Boolean(erroSet && errosConfirmados > 0);

  if (erroSet && comRespostaAluno === 0) {
    avisos.push(
      "Modo só erros: suas alternativas (A–E) não foram salvas. Para análise completa, use «Meu gabarito»."
    );
  } else if (comRespostaAluno > 0 && gabaritoOficialCount === 0) {
    avisos.push(
      "Gabarito oficial ainda não cadastrado na prova — erros confirmados só onde você listou ou quando o admin publicar o oficial."
    );
  } else if (comRespostaAluno > 0 && comparadosComOficial < comRespostaAluno) {
    avisos.push(
      `Gabarito oficial parcial (${comparadosComOficial}/${comRespostaAluno} das suas respostas comparadas).`
    );
  }

  return { attempts, analiseCompleta, avisos };
}

function respostasPorNumeroFromInput(
  questoes: Array<{ numero: number }>,
  input: RegistrarTentativaInput
): Map<number, string> {
  if (input.gabaritoAluno?.trim()) {
    return parseGabaritoLote(input.gabaritoAluno);
  }
  if (input.respostas?.trim()) {
    return sequenciaParaMapaPorNumero(questoes, input.respostas);
  }
  return new Map();
}

export async function registrarTentativaProva(input: RegistrarTentativaInput) {
  const prova = await prisma.prova.findUnique({
    where: { id: input.provaId },
    include: { questoes: { orderBy: { numero: "asc" } } },
  });

  if (!prova) throw new Error("PROVA_NOT_FOUND");
  if (!prova.publicada) throw new Error("PROVA_NOT_PUBLISHED");
  if (prova.questoes.length === 0) throw new Error("PROVA_EMPTY");

  const temGabaritoAluno =
    Boolean(input.gabaritoAluno?.trim()) || Boolean(input.respostas?.trim());
  const temErros = Boolean(input.apenasErros?.length);

  if (!temGabaritoAluno && !temErros) {
    throw new Error("GABARITO_ALUNO_OBRIGATORIO");
  }

  const respostasPorNumero = respostasPorNumeroFromInput(prova.questoes, input);
  const { attempts: rawAttempts, analiseCompleta, avisos } = buildAttemptsFromProva(
    prova.questoes,
    respostasPorNumero,
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

  if (!analiseCompleta && avisos.length > 0) {
    diagnosis.mensagem = `${diagnosis.mensagem} ${avisos[0]}`;
  }

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
            analiseCompleta,
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

  return { exam, diagnosis, prova, analiseCompleta, avisos };
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
