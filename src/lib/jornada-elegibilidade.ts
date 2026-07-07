/**
 * Elegibilidade da Jornada — docs/MOTOR-JORNADA-DIAGNOSTICO.md §2.1 e §16.
 * Uma prova isolada não libera a Jornada longitudinal; só relatório da prova.
 */
import type { ModoUsoRegistro } from "@/generated/prisma/client";
import {
  erroAnalisavel,
  questaoTemN1N2N3,
  resolverClassificacaoAttempt,
  type QuestaoCatalogoClassificacao,
} from "@/lib/jornada-classificacao-attempt";
import { prisma } from "@/lib/prisma";
import {
  agruparUnidadesJornada,
  PROVA_SELECT_MULTIDIA,
  type ExamParaAgrupamento,
} from "@/lib/prova-multidia";
import {
  MIN_ERROS_ANALISAVEIS_JORNADA,
  MIN_PCT_N1N2N3_JORNADA,
  MIN_PROVAS_JORNADA,
  MIN_QUESTOES_JORNADA,
  type ElegibilidadeJornada,
  type MetricasElegibilidadeJornada,
} from "@/lib/jornada-elegibilidade-shared";

export {
  MIN_ERROS_ANALISAVEIS_JORNADA,
  MIN_PCT_N1N2N3_JORNADA,
  MIN_PROVAS_JORNADA,
  MIN_QUESTOES_JORNADA,
  type ElegibilidadeJornada,
  type MetricasElegibilidadeJornada,
} from "@/lib/jornada-elegibilidade-shared";

export {
  erroAnalisavel,
  questaoTemN1N2N3,
  resolverClassificacaoAttempt,
} from "@/lib/jornada-classificacao-attempt";

export type ModoUsoEvidenciaJornada = ModoUsoRegistro;
/** Modos de uso que contam como evidência forte/média para elegibilidade. */
export const MODOS_USO_EVIDENCIA_JORNADA: ModoUsoEvidenciaJornada[] = ["OFICIAL", "TREINO"];

type AttemptRow = ExamParaAgrupamento<{ numero: number; correto: boolean }>["questionAttempts"][number] & {
  conhecimentoDominioId?: string | null;
  conhecimentoEscopoId?: string | null;
  conhecimentoExigido?: string | null;
  materiaId?: string | null;
  provaQuestao?: QuestaoCatalogoClassificacao | null;
};

function mapaCatalogoPorNumero(
  questoes: (QuestaoCatalogoClassificacao & { numero: number })[]
): Map<number, QuestaoCatalogoClassificacao> {
  return new Map(questoes.map((q) => [q.numero, q]));
}

export function examModoValidoParaJornada(modoUso: ModoUsoRegistro): boolean {
  return MODOS_USO_EVIDENCIA_JORNADA.includes(modoUso);
}

export function unidadeValidaParaJornada(
  unidade: { modoUso: ModoUsoRegistro; questionAttempts: unknown[] }
): boolean {
  return examModoValidoParaJornada(unidade.modoUso) && unidade.questionAttempts.length > 0;
}

/** Critérios objetivos — função pura para testes. */
export function calcularElegibilidadeJornada(metricas: MetricasElegibilidadeJornada): ElegibilidadeJornada {
  const motivosBloqueio: string[] = [];

  if (!metricas.anamneseConcluida) {
    motivosBloqueio.push("Conclua sua anamnese inicial.");
  }
  if (metricas.provasOuSimuladosValidos < MIN_PROVAS_JORNADA) {
    motivosBloqueio.push("Insira pelo menos duas provas ou simulados válidos.");
  }
  if (metricas.totalQuestoesValidas < MIN_QUESTOES_JORNADA) {
    motivosBloqueio.push("Ainda há poucas questões respondidas para iniciar a jornada.");
  }
  if (metricas.totalErrosAnalisaveis < MIN_ERROS_ANALISAVEIS_JORNADA) {
    motivosBloqueio.push("Ainda há poucos erros prontos para análise para gerar prioridades confiáveis.");
  }
  if (metricas.pctQuestoesComN1N2N3 < MIN_PCT_N1N2N3_JORNADA) {
    motivosBloqueio.push(
      "Algumas questões ainda estão sendo preparadas pela equipe antes de liberar sua Jornada."
    );
  }

  return {
    elegivel: motivosBloqueio.length === 0,
    motivosBloqueio,
    metricas,
  };
}

export async function coletarMetricasElegibilidadeJornada(
  userId: string
): Promise<MetricasElegibilidadeJornada> {
  const [anamnese, exams] = await Promise.all([
    prisma.studentAnamnesis.findUnique({
      where: { userId },
      select: { status: true },
    }),
    prisma.exam.findMany({
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
            provaQuestao: {
              select: {
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
    }),
  ]);

  const unidades = agruparUnidadesJornada(exams).filter(unidadeValidaParaJornada);
  const provasOuSimuladosValidos = unidades.length;

  let totalQuestoesValidas = 0;
  let totalErrosAnalisaveis = 0;
  let comN1N2N3 = 0;

  for (const unidade of unidades) {
    const catalogo = unidade.prova?.questoes
      ? mapaCatalogoPorNumero(unidade.prova.questoes)
      : new Map<number, QuestaoCatalogoClassificacao>();

    for (const attempt of unidade.questionAttempts as AttemptRow[]) {
      totalQuestoesValidas++;
      const classificacao = resolverClassificacaoAttempt(
        attempt,
        catalogo.get(attempt.numero) ?? null
      );
      if (questaoTemN1N2N3(classificacao)) comN1N2N3++;
      if (erroAnalisavel(classificacao)) totalErrosAnalisaveis++;
    }
  }

  const pctQuestoesComN1N2N3 =
    totalQuestoesValidas > 0 ? comN1N2N3 / totalQuestoesValidas : 0;

  return {
    anamneseConcluida: anamnese?.status === "COMPLETED",
    provasOuSimuladosValidos,
    totalQuestoesValidas,
    totalErrosAnalisaveis,
    pctQuestoesComN1N2N3,
  };
}

export async function avaliarElegibilidadeJornada(userId: string): Promise<ElegibilidadeJornada> {
  const metricas = await coletarMetricasElegibilidadeJornada(userId);
  return calcularElegibilidadeJornada(metricas);
}

/** Jornada longitudinal só após ação explícita do aluno (§2.3). */
export async function jornadaFoiIniciada(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { jornadaIniciadaEm: true },
  });
  return user?.jornadaIniciadaEm != null;
}

/**
 * Plano/quests legados — liberar na Etapa 4.
 * LearningCycle da Jornada é criado por jornada-ciclo-inicial (Etapa 3).
 */
export async function podeGerarPlanoJornada(_userId: string): Promise<boolean> {
  return false;
}

export type IniciarJornadaResult =
  | { ok: true; jaIniciada: boolean; snapshotInicialId: string; cicloInicialId: string }
  | { ok: false; error: string; motivosBloqueio?: string[] };

/** Delega ao motor de Diagnóstico Inicial (Etapa 2). */
export async function iniciarJornadaUsuario(userId: string): Promise<IniciarJornadaResult> {
  const { iniciarJornadaComDiagnosticoInicial } = await import(
    "@/lib/jornada-diagnostico-inicial"
  );
  return iniciarJornadaComDiagnosticoInicial(userId);
}
