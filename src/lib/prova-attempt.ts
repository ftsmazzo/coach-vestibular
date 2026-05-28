import type { ErrorType } from "@/generated/prisma/client";
import { prisma } from "./prisma";
import { aplicarPlanoCoachIA, buildDiagnosis, type AttemptInput } from "./diagnosis";
import { enriquecerDiagnosticoComProva } from "./diagnosis-prova";
import { generateStudyPlan, planToQuests } from "./study-plan";
import { mapMateriaAssuntoToTaxonomy, syncProvaGabaritoStatus } from "./prova-catalog";
import { parseGabaritoLote, sequenciaParaMapaPorNumero } from "./gabarito";
import { parseDataAplicacao } from "./data-prova";
import type { ModoUsoRegistro } from "@/generated/prisma/client";
import {
  historicalAttemptsDaJornada,
  mergeHistoricalAttempts,
  mesclarPlanoComJornada,
} from "./jornada-plano";
import { buildPlanoGlobalFromJornada } from "./jornada-diagnostico";
import { concederXpMelhoriaMaterias, concederXpRegistro } from "./xp";
import { modoUsoPadraoParaProva } from "./modo-uso";
import { provaEhOficial, rotulosDiagnostico } from "./prova-tipo";
import type { DiagnosisResult } from "./diagnosis";

export interface RegistrarTentativaInput {
  userId: string;
  provaId: string;
  /** YYYY-MM-DD — dia em que a prova foi aplicada (não o cadastro no app) */
  data: string;
  /** Apaga este registro antes de criar o novo (mesma prova) */
  substituirExamId?: string;
  checkInScore?: number;
  nota?: number;
  /** Linhas número,letra — gabarito do aluno (recomendado) */
  gabaritoAluno?: string;
  /** Sequência de respostas A–E na ordem das questões cadastradas */
  respostas?: string;
  /** Só números errados — análise parcial se não houver gabarito do aluno */
  apenasErros?: number[];
  /** Como esta atividade entra na jornada (peso no plano global) */
  modoUso?: ModoUsoRegistro;
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

      const row: AttemptWithMeta = {
        numero: q.numero,
        correto,
        materiaId: materiaId ?? undefined,
        temaId: temaId ?? undefined,
        provaQuestaoId: q.id,
        respostaAluno,
      };
      return row;
    })
    .filter((a): a is AttemptWithMeta => a !== null);

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

  if (!input.data?.trim()) throw new Error("DATA_OBRIGATORIA");

  if (input.substituirExamId) {
    const anterior = await prisma.exam.findFirst({
      where: {
        id: input.substituirExamId,
        userId: input.userId,
        provaId: input.provaId,
      },
    });
    if (!anterior) throw new Error("EXAM_NOT_FOUND");
    await prisma.exam.delete({ where: { id: anterior.id } });
  }

  const dataAplicacao = parseDataAplicacao(input.data);

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

  const historicalMesmaProva: AttemptInput[][] = historicalExams.map((e) =>
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
  const historicalJornada = await historicalAttemptsDaJornada(input.userId);
  const historicalAttempts = mergeHistoricalAttempts(
    historicalMesmaProva,
    historicalJornada
  );

  const questoesPedagogicas = rawAttempts.map((a) => {
    const q = prova.questoes.find((pq) => pq.numero === a.numero)!;
    return {
      numero: a.numero,
      correto: a.correto,
      materia: q.materia,
      assunto: q.assunto,
      conhecimentoExigido: q.conhecimentoExigido,
      nivelDificuldade: q.nivelDificuldade,
    };
  });

  const modoUso =
    input.modoUso ?? modoUsoPadraoParaProva(prova.tipo);

  const rotulos = rotulosDiagnostico(
    modoUso === "OFICIAL" ? "prova_oficial" : "simulado"
  );

  let diagnosis = await buildDiagnosis(
    rawAttempts.map(({ numero, correto, materiaId, temaId, tipoErro }) => ({
      numero,
      correto,
      materiaId,
      temaId,
      tipoErro: tipoErro as ErrorType | null | undefined,
    })),
    historicalAttempts,
    {
      checkInScore: input.checkInScore,
      examLabel: rotulos.curto,
      provaTipo: prova.tipo,
      modoUso,
    }
  );

  diagnosis = enriquecerDiagnosticoComProva(
    diagnosis,
    questoesPedagogicas,
    input.checkInScore
  );

  diagnosis = await aplicarPlanoCoachIA(diagnosis, rawAttempts, {
    checkInScore: input.checkInScore,
    examLabel: rotulos.curto,
  });

  if (!analiseCompleta && avisos.length > 0) {
    diagnosis.mensagem = `${diagnosis.mensagem} ${avisos[0]}`;
  }

  const exam = await prisma.exam.create({
    data: {
      userId: input.userId,
      provaId: prova.id,
      nome: prova.nome,
      data: dataAplicacao,
      banca: prova.banca,
      totalQuestoes: prova.totalQuestoes,
      nota: input.nota,
      checkInScore: input.checkInScore,
      recoveryMode: diagnosis.recoveryMode,
      modoUso,
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
            resumoProva: diagnosis.resumoProva,
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

  const rawForPlano = rawAttempts.map(({ numero, correto, materiaId, temaId, tipoErro }) => ({
    numero,
    correto,
    materiaId,
    temaId,
    tipoErro: tipoErro as ErrorType | null | undefined,
  }));

  await aplicarPlanoEQuests(
    input.userId,
    diagnosis,
    provaEhOficial(prova.tipo),
    rawForPlano
  );

  await prisma.exam.update({
    where: { id: exam.id },
    data: { recoveryMode: diagnosis.recoveryMode },
  });

  const xpMelhorias = await concederXpMelhoriaMaterias(
    input.userId,
    exam.id,
    diagnosis.materiaScores
  );
  const xpRegistro = await concederXpRegistro(input.userId, exam.id, exam.data);

  const xpMensagens = [...xpMelhorias, ...xpRegistro.mensagens];

  return {
    exam,
    diagnosis,
    prova,
    analiseCompleta,
    avisos,
    substituiu: Boolean(input.substituirExamId),
    xpMelhorias: xpMensagens,
  };
}

async function aplicarPlanoEQuests(
  userId: string,
  diagnosis: DiagnosisResult,
  ehProvaOficial: boolean,
  rawAttemptsUltimo: AttemptInput[] = []
) {
  await prisma.quest.updateMany({
    where: { userId, status: "pending" },
    data: { status: "skipped" },
  });

  let planDiagnosis = await buildPlanoGlobalFromJornada(
    userId,
    diagnosis,
    rawAttemptsUltimo,
    { planoSoJornada: true }
  );

  let items =
    planDiagnosis.aiStudyPlanItems?.length
      ? planDiagnosis.aiStudyPlanItems
      : generateStudyPlan(planDiagnosis, { ehProvaOficial }).items;
  if (!planDiagnosis.aiStudyPlanItems?.length) {
    planDiagnosis = { ...planDiagnosis, planoCoachStatus: "legado" };
  }
  items = await mesclarPlanoComJornada(items, userId);
  items = items.map((item) => ({ ...item, errosContexto: "jornada" as const }));
  const recoveryMode = planDiagnosis.recoveryMode;
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);

  await prisma.studyPlan.create({
    data: {
      userId,
      escopo: "GLOBAL",
      provaId: null,
      weekStart,
      itemsJson: JSON.stringify(items),
      recoveryMode,
    },
  });

  await prisma.quest.createMany({ data: planToQuests(items, userId) });
}

/** Recria plano global e quests a partir da jornada atual (ex.: após excluir registro inválido). */
export async function regenerarPlanoGlobalUsuario(userId: string) {
  const { buildDiagnosisFromJornada } = await import("@/lib/jornada-diagnostico");
  const diagnosis = await buildDiagnosisFromJornada(userId);
  await aplicarPlanoEQuests(userId, diagnosis, false, []);
}

/** Recalcula diagnóstico, plano e quests a partir do gabarito já salvo (sem redigitar). */
export async function recalcularDiagnosticoExam(examId: string, requestUserId?: string) {
  const exam = await prisma.exam.findUnique({
    where: { id: examId },
    include: {
      prova: { include: { questoes: true } },
      questionAttempts: { include: { provaQuestao: true }, orderBy: { numero: "asc" } },
      diagnosticSnapshot: true,
    },
  });

  if (!exam) throw new Error("EXAM_NOT_FOUND");

  if (requestUserId) {
    const reqUser = await prisma.user.findUnique({ where: { id: requestUserId } });
    if (!reqUser) throw new Error("UNAUTHORIZED");
    if (exam.userId !== requestUserId && reqUser.role !== "ADMIN") {
      throw new Error("UNAUTHORIZED");
    }
  }

  const userId = exam.userId;

  if (!exam.prova || !exam.provaId) throw new Error("SEM_PROVA_VINCULADA");
  if (exam.questionAttempts.length === 0) throw new Error("SEM_QUESTOES");

  const prova = exam.prova;
  const rotulos = rotulosDiagnostico(
    provaEhOficial(prova.tipo) ? "prova_oficial" : "simulado"
  );

  const historicalExams = await prisma.exam.findMany({
    where: { userId, provaId: prova.id, id: { not: examId } },
    orderBy: { data: "desc" },
    take: 5,
    include: { questionAttempts: { include: { provaQuestao: true } } },
  });

  const historicalMesmaProva: AttemptInput[][] = historicalExams.map((e) =>
    e.questionAttempts.map((a) => {
      const mat = a.materiaCorrigida || a.provaQuestao?.materia;
      const ass = a.assuntoCorrigido || a.provaQuestao?.assunto;
      const mapped = (mat && ass) ? mapMateriaAssuntoToTaxonomy(mat, ass) : undefined;
      return {
        numero: a.numero,
        correto: a.correto,
        materiaId: a.materiaId ?? mapped?.materiaId,
        temaId: a.temaId ?? mapped?.temaId,
        tipoErro: a.tipoErro,
        observacao: a.observacao,
      };
    })
  );
  const historicalJornada = await historicalAttemptsDaJornada(userId, examId);
  const historicalAttempts = mergeHistoricalAttempts(
    historicalMesmaProva,
    historicalJornada
  );

  const rawAttempts: AttemptInput[] = exam.questionAttempts.map((a) => {
    const pq =
      a.provaQuestao ?? prova.questoes.find((q) => q.numero === a.numero);
    const mat = a.materiaCorrigida || pq?.materia;
    const ass = a.assuntoCorrigido || pq?.assunto;
    const mapped = (mat && ass) ? mapMateriaAssuntoToTaxonomy(mat, ass) : undefined;
    return {
      numero: a.numero,
      correto: a.correto,
      materiaId: a.materiaId ?? mapped?.materiaId,
      temaId: a.temaId ?? mapped?.temaId,
      tipoErro: a.tipoErro,
      observacao: a.observacao,
    };
  });

  const questoesPedagogicas = exam.questionAttempts.map((a) => {
    const q =
      a.provaQuestao ?? prova.questoes.find((pq) => pq.numero === a.numero)!;
    return {
      numero: a.numero,
      correto: a.correto,
      materia: a.materiaCorrigida || q.materia,
      assunto: a.assuntoCorrigido || q.assunto,
      conhecimentoExigido: q.conhecimentoExigido,
      nivelDificuldade: q.nivelDificuldade,
    };
  });

  let diagnosis = await buildDiagnosis(rawAttempts, historicalAttempts, {
    checkInScore: exam.checkInScore,
    examLabel: rotulos.curto,
    provaTipo: prova.tipo,
    modoUso: exam.modoUso,
  });

  diagnosis = enriquecerDiagnosticoComProva(
    diagnosis,
    questoesPedagogicas,
    exam.checkInScore
  );

  diagnosis = await aplicarPlanoCoachIA(diagnosis, rawAttempts, {
    checkInScore: exam.checkInScore,
    examLabel: rotulos.curto,
  });

  const analiseCompleta = exam.questionAttempts.every((a) => a.respostaAluno != null);

  if (exam.diagnosticSnapshot) {
    await prisma.diagnosticSnapshot.update({
      where: { examId: exam.id },
      data: {
        scoresJson: JSON.stringify({
          overallAcerto: diagnosis.overallAcerto,
          materiaScores: diagnosis.materiaScores,
          temaScores: diagnosis.temaScores,
          resumoProva: diagnosis.resumoProva,
          provaId: prova.id,
          analiseCompleta,
        }),
        focosJson: JSON.stringify(diagnosis.focos),
        mensagem: diagnosis.mensagem,
        recoveryMode: diagnosis.recoveryMode,
      },
    });
  }

  await prisma.exam.update({
    where: { id: exam.id },
    data: { recoveryMode: diagnosis.recoveryMode },
  });

  await aplicarPlanoEQuests(userId, diagnosis, provaEhOficial(prova.tipo), rawAttempts);

  const xpMelhorias = await concederXpMelhoriaMaterias(
    userId,
    exam.id,
    diagnosis.materiaScores
  );
  const xpRegistro = await concederXpRegistro(userId, exam.id, exam.data);

  return {
    examId: exam.id,
    diagnosis,
    planoCoachStatus: diagnosis.planoCoachStatus ?? "ia",
    planoCoachAviso: diagnosis.planoCoachAviso,
    xpMelhorias: [...xpMelhorias, ...xpRegistro.mensagens],
  };
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
