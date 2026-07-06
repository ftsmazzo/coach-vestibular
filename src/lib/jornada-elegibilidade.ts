/**
 * Elegibilidade da Jornada — docs/MOTOR-JORNADA-DIAGNOSTICO.md §2.1 e §16.
 * Uma prova isolada não libera a Jornada longitudinal; só relatório da prova.
 */
import type { ModoUsoRegistro } from "@/generated/prisma/client";
import { parseClassificacaoN1 } from "@/lib/classificacao-n1-types";
import { escopoN2Real } from "@/lib/classificacao-n2-types";
import { prisma } from "@/lib/prisma";
import {
  agruparUnidadesJornada,
  PROVA_SELECT_MULTIDIA,
  type ExamParaAgrupamento,
} from "@/lib/prova-multidia";

export const MIN_PROVAS_JORNADA = 2;
export const MIN_QUESTOES_JORNADA = 80;
export const MIN_ERROS_ANALISAVEIS_JORNADA = 15;
export const MIN_PCT_N1N2N3_JORNADA = 0.95;

/** Modos de uso que contam como evidência forte/média para elegibilidade. */
export const MODOS_USO_EVIDENCIA_JORNADA: ModoUsoRegistro[] = ["OFICIAL", "TREINO"];

export type MetricasElegibilidadeJornada = {
  anamneseConcluida: boolean;
  provasOuSimuladosValidos: number;
  totalQuestoesValidas: number;
  totalErrosAnalisaveis: number;
  pctQuestoesComN1N2N3: number;
};

export type ElegibilidadeJornada = {
  elegivel: boolean;
  motivosBloqueio: string[];
  metricas: MetricasElegibilidadeJornada;
};

type AttemptClassificacao = {
  correto: boolean;
  n1CatalogoId: string | null;
  escopoId: string | null;
  conhecimentoExigido: string | null;
};

type AttemptRow = ExamParaAgrupamento["questionAttempts"][number] & {
  conhecimentoDominioId?: string | null;
  conhecimentoEscopoId?: string | null;
  conhecimentoExigido?: string | null;
  materiaId?: string | null;
  provaQuestao?: {
    classificacaoN1Json?: string | null;
    conhecimentoDominioId?: string | null;
    conhecimentoEscopoId?: string | null;
    conhecimentoExigido?: string | null;
    materia?: string;
  } | null;
};

function resolverClassificacaoAttempt(a: AttemptRow): AttemptClassificacao {
  const pq = a.provaQuestao;
  const n1 = parseClassificacaoN1(pq?.classificacaoN1Json);
  const escopoId = a.conhecimentoEscopoId ?? pq?.conhecimentoEscopoId ?? null;
  const conhecimentoExigido = a.conhecimentoExigido ?? pq?.conhecimentoExigido ?? null;
  const dominioId = a.conhecimentoDominioId ?? pq?.conhecimentoDominioId ?? null;
  const n1CatalogoId =
    n1?.catalogoId ??
    dominioId?.split(".")[0] ??
    a.materiaId?.trim().toLowerCase() ??
    pq?.materia?.trim().toLowerCase() ??
    null;

  return { correto: a.correto, n1CatalogoId, escopoId, conhecimentoExigido };
}

/** Questão com classificação pedagógica completa (N1 + N2 real + N3). */
export function questaoTemN1N2N3(c: Pick<AttemptClassificacao, "n1CatalogoId" | "escopoId" | "conhecimentoExigido">): boolean {
  const n1Ok = Boolean(c.n1CatalogoId?.trim());
  const n2Ok = escopoN2Real(c.escopoId);
  const n3Ok = Boolean(c.conhecimentoExigido?.trim());
  return n1Ok && n2Ok && n3Ok;
}

/** Erro com classificação suficiente para priorização (N1/N2/N3). */
export function erroAnalisavel(c: AttemptClassificacao): boolean {
  return !c.correto && questaoTemN1N2N3(c);
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
    motivosBloqueio.push("Ainda há poucos erros analisáveis para gerar prioridades confiáveis.");
  }
  if (metricas.pctQuestoesComN1N2N3 < MIN_PCT_N1N2N3_JORNADA) {
    motivosBloqueio.push("Algumas questões ainda não possuem classificação pedagógica completa.");
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
        prova: { select: PROVA_SELECT_MULTIDIA },
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
    for (const attempt of unidade.questionAttempts as AttemptRow[]) {
      totalQuestoesValidas++;
      const classificacao = resolverClassificacaoAttempt(attempt);
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
 * Plano semanal, quests de ciclo e LearningCycle só após iniciar a Jornada.
 * Relatórios por prova e DiagnosticSnapshot por exam continuam permitidos.
 */
export async function podeGerarPlanoJornada(userId: string): Promise<boolean> {
  return jornadaFoiIniciada(userId);
}

export type IniciarJornadaResult =
  | { ok: true; jaIniciada: boolean }
  | { ok: false; error: string; motivosBloqueio?: string[] };

/**
 * Marca início da Jornada (placeholder seguro — motor de Diagnóstico Inicial vem na próxima etapa).
 * Não gera plano/ciclo legado automaticamente.
 */
export async function iniciarJornadaUsuario(userId: string): Promise<IniciarJornadaResult> {
  const elegibilidade = await avaliarElegibilidadeJornada(userId);
  if (!elegibilidade.elegivel) {
    return {
      ok: false,
      error: elegibilidade.motivosBloqueio[0] ?? "Critérios de elegibilidade não atendidos.",
      motivosBloqueio: elegibilidade.motivosBloqueio,
    };
  }

  const jaIniciada = await jornadaFoiIniciada(userId);
  if (jaIniciada) return { ok: true, jaIniciada: true };

  await prisma.user.update({
    where: { id: userId },
    data: { jornadaIniciadaEm: new Date() },
  });

  return { ok: true, jaIniciada: false };
}
