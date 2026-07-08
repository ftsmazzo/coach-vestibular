/**
 * Auditoria de coerência — Etapa 4E-A.
 * Compara evidência canônica com diagnóstico, ciclo e gráficos de prova.
 */
import { montarExamGraficos } from "@/lib/exam-graficos";
import { buscarSnapshotInicialJornada, type BaselineJornada } from "@/lib/jornada-diagnostico-inicial";
import { buscarResumoCicloInicialJornada } from "@/lib/jornada-ciclo-inicial";
import {
  compararCicloComCanonica,
  compararDiagnosticoComCanonica,
  compararGraficoProvaComCanonica,
  type DivergenciaAuditoria,
} from "@/lib/jornada-auditoria-comparacao";
import {
  buscarEscopoAgregadoCanonica,
  coletarEvidenciaCanonicaJornada,
  evidenciaCanonicaFocoDeAgregado,
  type EscopoAgregadoCanonica,
  type ResultadoEvidenciaCanonicaJornada,
} from "@/lib/jornada-evidencia-canonica";
import { prisma } from "@/lib/prisma";

export type { DivergenciaAuditoria } from "@/lib/jornada-auditoria-comparacao";
export {
  compararCicloComCanonica,
  compararDiagnosticoComCanonica,
  compararGraficoProvaComCanonica,
} from "@/lib/jornada-auditoria-comparacao";

export type AuditoriaDadosJornada = {
  userId: string;
  totais: ResultadoEvidenciaCanonicaJornada["totais"];
  porProva: ResultadoEvidenciaCanonicaJornada["porProva"];
  agregadoPorEscopo: ResultadoEvidenciaCanonicaJornada["agregadoPorEscopo"];
  divergencias: DivergenciaAuditoria[];
  questoesComDivergenciaEscopo: number;
  diagnosticoInicial: {
    snapshotId: string | null;
    escoposNoSnapshot: number;
  };
  cicloInicial: {
    cicloId: string | null;
    metaEscopoId: string | null;
    errosNoEscopo: number | null;
    totalQuestoesNoEscopo: number | null;
  };
  escopoFiltrado?: EscopoAgregadoCanonica | null;
  evidenciaCanonicaFoco?: ReturnType<typeof evidenciaCanonicaFocoDeAgregado>;
};

export async function auditarCoerenciaDadosJornada(
  userId: string,
  opts?: { escopoId?: string; escopoLabel?: string }
): Promise<AuditoriaDadosJornada> {
  const [canonica, snapshot, ciclo] = await Promise.all([
    coletarEvidenciaCanonicaJornada(userId),
    buscarSnapshotInicialJornada(userId),
    buscarResumoCicloInicialJornada(userId),
  ]);

  const divergencias: DivergenciaAuditoria[] = [];
  const questoesComDivergenciaEscopo = canonica.questoes.filter((q) => q.divergenciaEscopo).length;

  if (snapshot?.baselineJson) {
    const baseline = JSON.parse(snapshot.baselineJson) as BaselineJornada;
    divergencias.push(
      ...compararDiagnosticoComCanonica(canonica.agregadoPorEscopo, baseline.porEscopo)
    );
  }

  if (ciclo?.baseline) {
    divergencias.push(
      ...compararCicloComCanonica(
        canonica.agregadoPorEscopo,
        ciclo.metaEscopoId,
        ciclo.baseline.evidencias.errosNoEscopo,
        ciclo.baseline.evidencias.totalQuestoesNoEscopo
      )
    );
  }

  const exams = await prisma.exam.findMany({
    where: { userId },
    include: {
      questionAttempts: { include: { provaQuestao: true } },
    },
  });
  const examMap = new Map(exams.map((e) => [e.id, e]));

  for (const prova of canonica.porProva) {
    const exam = examMap.get(prova.examId);
    if (exam) {
      const graficos = montarExamGraficos(exam.questionAttempts);
      divergencias.push(
        ...compararGraficoProvaComCanonica(prova.nome, prova.porEscopo, graficos.escopos)
      );
    }
  }

  const filtro = opts?.escopoId ?? opts?.escopoLabel;
  const escopoFiltrado = filtro ? buscarEscopoAgregadoCanonica(canonica, filtro) : null;

  return {
    userId,
    totais: canonica.totais,
    porProva: canonica.porProva,
    agregadoPorEscopo: canonica.agregadoPorEscopo,
    divergencias,
    questoesComDivergenciaEscopo,
    diagnosticoInicial: {
      snapshotId: snapshot?.id ?? null,
      escoposNoSnapshot: snapshot?.baselineJson
        ? (JSON.parse(snapshot.baselineJson) as BaselineJornada).porEscopo.length
        : 0,
    },
    cicloInicial: {
      cicloId: ciclo?.cicloId ?? null,
      metaEscopoId: ciclo?.metaEscopoId ?? null,
      errosNoEscopo: ciclo?.baseline.evidencias.errosNoEscopo ?? null,
      totalQuestoesNoEscopo: ciclo?.baseline.evidencias.totalQuestoesNoEscopo ?? null,
    },
    escopoFiltrado,
    evidenciaCanonicaFoco: escopoFiltrado
      ? evidenciaCanonicaFocoDeAgregado(escopoFiltrado)
      : undefined,
  };
}
