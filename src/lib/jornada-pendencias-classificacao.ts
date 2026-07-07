/**
 * Diagnóstico de pendências N1/N2/N3 e sincronização attempt ← ProvaQuestao.
 */
import type { Prisma } from "@/generated/prisma/client";
import {
  agruparUnidadesJornada,
  PROVA_SELECT_MULTIDIA,
  type ExamParaAgrupamento,
} from "@/lib/prova-multidia";
import {
  catalogoQuestoesUnidadeJornada,
  nomeProvaUnidadeJornada,
} from "@/lib/jornada-catalogo-unidade";
import {
  motivosPendenciaClassificacao,
  montarAtualizacaoSnapshotClassificacao,
  questaoTemN1N2N3,
  resolverClassificacaoAttempt,
  type QuestaoCatalogoClassificacao,
} from "@/lib/jornada-classificacao-attempt";
import {
  MODOS_USO_EVIDENCIA_JORNADA,
  unidadeValidaParaJornada,
} from "@/lib/jornada-elegibilidade";
import { prisma } from "@/lib/prisma";

export type PendenciaQuestaoClassificacao = {
  numero: number;
  temN1: boolean;
  temN2: boolean;
  temN3: boolean;
  attemptConhecimentoExigido?: string | null;
  provaQuestaoConhecimentoExigido?: string | null;
  attemptEscopoId?: string | null;
  provaQuestaoEscopoId?: string | null;
  motivo: string[];
};

export type PendenciasClassificacaoPorProva = {
  examId: string;
  provaId?: string | null;
  nome: string;
  total: number;
  completas: number;
  pct: number;
  pendentes: PendenciaQuestaoClassificacao[];
};

export type RelatorioPendenciasClassificacaoJornada = {
  totalQuestoesValidas: number;
  totalComClassificacaoCompleta: number;
  pctQuestoesComN1N2N3: number;
  porProva: PendenciasClassificacaoPorProva[];
};

type AttemptRow = ExamParaAgrupamento<{ numero: number; correto: boolean }>["questionAttempts"][number] & {
  conhecimentoDominioId?: string | null;
  conhecimentoEscopoId?: string | null;
  conhecimentoExigido?: string | null;
  materiaId?: string | null;
  provaQuestaoId?: string | null;
  provaQuestao?: QuestaoCatalogoClassificacao | null;
};

type DbClient = Prisma.TransactionClient | typeof prisma;

export async function coletarPendenciasClassificacaoJornada(
  userId: string,
  db: DbClient = prisma
): Promise<RelatorioPendenciasClassificacaoJornada> {
  const exams = await db.exam.findMany({
    where: { userId },
    include: {
      questionAttempts: {
        select: {
          numero: true,
          correto: true,
          materiaId: true,
          conhecimentoDominioId: true,
          conhecimentoEscopoId: true,
          conhecimentoExigido: true,
          provaQuestaoId: true,
          provaQuestao: {
            select: {
              numero: true,
              materia: true,
              classificacaoN1Json: true,
              conhecimentoDominioId: true,
              conhecimentoEscopoId: true,
              conhecimentoExigido: true,
            },
          },
        },
      },
      prova: {
        select: {
          ...PROVA_SELECT_MULTIDIA,
          questoes: {
            select: {
              numero: true,
              materia: true,
              classificacaoN1Json: true,
              conhecimentoDominioId: true,
              conhecimentoEscopoId: true,
              conhecimentoExigido: true,
            },
          },
        },
      },
    },
    orderBy: { data: "desc" },
  });

  const unidades = agruparUnidadesJornada(exams).filter(unidadeValidaParaJornada);

  let totalQuestoesValidas = 0;
  let totalComClassificacaoCompleta = 0;
  const porProva: PendenciasClassificacaoPorProva[] = [];

  for (const unidade of unidades) {
    const catalogo = catalogoQuestoesUnidadeJornada(unidade);

    let completasUnidade = 0;
    const pendentes: PendenciaQuestaoClassificacao[] = [];

    for (const attempt of unidade.questionAttempts as AttemptRow[]) {
      totalQuestoesValidas++;
      const catalogoQuestao = catalogo.get(attempt.numero) ?? null;
      const classificacao = resolverClassificacaoAttempt(attempt, catalogoQuestao);
      const completa = questaoTemN1N2N3(classificacao);
      if (completa) {
        completasUnidade++;
        totalComClassificacaoCompleta++;
      } else {
        const motivos = motivosPendenciaClassificacao(classificacao);
        if (!attempt.provaQuestaoId && !catalogoQuestao) {
          motivos.push("sem vínculo com questão do catálogo");
        }
        pendentes.push({
          numero: attempt.numero,
          temN1: Boolean(classificacao.n1CatalogoId?.trim()),
          temN2: Boolean(classificacao.escopoId?.trim()),
          temN3: Boolean(classificacao.conhecimentoExigido?.trim()),
          attemptConhecimentoExigido: attempt.conhecimentoExigido ?? null,
          provaQuestaoConhecimentoExigido:
            attempt.provaQuestao?.conhecimentoExigido ?? catalogoQuestao?.conhecimentoExigido ?? null,
          attemptEscopoId: attempt.conhecimentoEscopoId ?? null,
          provaQuestaoEscopoId:
            attempt.provaQuestao?.conhecimentoEscopoId ?? catalogoQuestao?.conhecimentoEscopoId ?? null,
          motivo: motivos,
        });
      }
    }

    const total = unidade.questionAttempts.length;
    porProva.push({
      examId: unidade.id,
      provaId: unidade.provaId,
      nome: nomeProvaUnidadeJornada(unidade),
      total,
      completas: completasUnidade,
      pct: total > 0 ? Math.round((completasUnidade / total) * 100) : 0,
      pendentes: pendentes.sort((a, b) => a.numero - b.numero),
    });
  }

  return {
    totalQuestoesValidas,
    totalComClassificacaoCompleta,
    pctQuestoesComN1N2N3:
      totalQuestoesValidas > 0 ? totalComClassificacaoCompleta / totalQuestoesValidas : 0,
    porProva,
  };
}

export type ResultadoSyncSnapshots = {
  provaId: string;
  attemptsAnalisados: number;
  attemptsAtualizados: number;
  provaQuestaoIdVinculados: number;
};

export async function sincronizarSnapshotsClassificacaoAttemptsDaProva(
  provaId: string,
  db: DbClient = prisma
): Promise<ResultadoSyncSnapshots> {
  const questoes = await db.provaQuestao.findMany({
    where: { provaId },
    select: {
      id: true,
      numero: true,
      conhecimentoDominioId: true,
      conhecimentoEscopoId: true,
      conhecimentoExigido: true,
      classificacaoVersao: true,
      classificacaoConfianca: true,
      conceitosCanonicosJson: true,
      classificacaoSecundariosJson: true,
    },
  });

  const porNumero = new Map(questoes.map((q) => [q.numero, q]));
  const attempts = await db.questionAttempt.findMany({
    where: { exam: { provaId } },
    select: {
      id: true,
      numero: true,
      correto: true,
      respostaAluno: true,
      provaQuestaoId: true,
      conhecimentoDominioId: true,
      conhecimentoEscopoId: true,
      conhecimentoExigido: true,
      classificacaoVersao: true,
      classificacaoConfianca: true,
      conceitosCanonicosJson: true,
      classificacaoSecundariosJson: true,
      provaQuestao: {
        select: {
          id: true,
          conhecimentoDominioId: true,
          conhecimentoEscopoId: true,
          conhecimentoExigido: true,
          classificacaoVersao: true,
          classificacaoConfianca: true,
          conceitosCanonicosJson: true,
          classificacaoSecundariosJson: true,
        },
      },
    },
  });

  let attemptsAtualizados = 0;
  let provaQuestaoIdVinculados = 0;

  for (const attempt of attempts) {
    const pq =
      attempt.provaQuestao ??
      (() => {
        const cat = porNumero.get(attempt.numero);
        return cat ? { ...cat } : null;
      })();

    if (!pq) continue;

    const tinhaVinculo = Boolean(attempt.provaQuestaoId);
    const { data, alterou } = montarAtualizacaoSnapshotClassificacao(attempt, pq);
    if (!alterou) continue;

    if (data.provaQuestaoId && !tinhaVinculo) provaQuestaoIdVinculados++;

    await db.questionAttempt.update({
      where: { id: attempt.id },
      data: {
        conhecimentoDominioId: data.conhecimentoDominioId,
        conhecimentoEscopoId: data.conhecimentoEscopoId,
        conhecimentoExigido: data.conhecimentoExigido,
        classificacaoVersao: data.classificacaoVersao,
        classificacaoConfianca: data.classificacaoConfianca,
        conceitosCanonicosJson: data.conceitosCanonicosJson,
        classificacaoSecundariosJson: data.classificacaoSecundariosJson,
        ...(data.provaQuestaoId ? { provaQuestaoId: data.provaQuestaoId } : {}),
      },
    });
    attemptsAtualizados++;
  }

  return {
    provaId,
    attemptsAnalisados: attempts.length,
    attemptsAtualizados,
    provaQuestaoIdVinculados,
  };
}

export async function sincronizarSnapshotsClassificacaoAttemptsDoUsuario(
  userId: string,
  provaId?: string,
  db: DbClient = prisma
): Promise<ResultadoSyncSnapshots[]> {
  if (provaId) {
    return [await sincronizarSnapshotsClassificacaoAttemptsDaProva(provaId, db)];
  }

  const provas = await db.exam.findMany({
    where: { userId, provaId: { not: null }, modoUso: { in: MODOS_USO_EVIDENCIA_JORNADA } },
    select: { provaId: true },
    distinct: ["provaId"],
  });

  const resultados: ResultadoSyncSnapshots[] = [];
  for (const row of provas) {
    if (!row.provaId) continue;
    resultados.push(await sincronizarSnapshotsClassificacaoAttemptsDaProva(row.provaId, db));
  }
  return resultados;
}
