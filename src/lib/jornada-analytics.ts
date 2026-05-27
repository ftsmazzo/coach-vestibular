import type { ModoUsoRegistro } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { formatDataAplicacao } from "@/lib/data-prova";
import { pctAcertoRegistro } from "@/lib/exam-stats";
import { pesoBancaParaMeta, textoMetaAluno } from "@/lib/meta-vestibular";
import { pesoModoUso } from "@/lib/modo-uso";
import { mapMateriaAssuntoToTaxonomy } from "@/lib/prova-catalog";
import { categoriaDoRegistro } from "@/lib/prova-tipo";
import { getMateriaLabel } from "@/lib/taxonomy";

export interface MateriaMediaJornada {
  materiaId: string;
  label: string;
  pctAcerto: number;
  totalPonderado: number;
  errosPonderados: number;
}

export interface MateriaSerieProva {
  examId: string;
  nome: string;
  dataLabel: string;
  pctGeral: number;
  materias: Record<string, number>;
}

export interface RegistroDashboardCard {
  id: string;
  nome: string;
  dataLabel: string;
  pct: number;
  modoUso: ModoUsoRegistro;
  categoria: string;
  provaId: string | null;
}

export interface JornadaDashboardAnalytics {
  pctGlobalPonderado: number;
  totalRegistros: number;
  materiasMedia: MateriaMediaJornada[];
  seriesPorProva: MateriaSerieProva[];
  registrosRecentes: RegistroDashboardCard[];
  materiaIdsOrdenados: string[];
}

function pesoExam(
  exam: { modoUso: ModoUsoRegistro; banca: string | null },
  metaProva?: string | null,
  vestibularAlvo?: string | null
) {
  return pesoModoUso(exam.modoUso) * pesoBancaParaMeta(exam.banca, metaProva, vestibularAlvo);
}

export async function buildJornadaDashboardAnalytics(
  userId: string,
  filtro: "todos" | "provas" | "simulados" = "todos"
): Promise<JornadaDashboardAnalytics> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { metaProva: true, vestibularAlvo: true },
  });

  const exams = await prisma.exam.findMany({
    where: { userId },
    orderBy: { data: "desc" },
    include: {
      questionAttempts: { include: { provaQuestao: true } },
      prova: { select: { tipo: true } },
    },
  });

  const { registroPassaFiltro } = await import("@/lib/prova-tipo");
  const filtrados = exams.filter((e) => registroPassaFiltro(e, filtro));

  const materiaAcc = new Map<
    string,
    { acertos: number; total: number; erros: number }
  >();
  let somaPesoAcerto = 0;
  let somaPeso = 0;

  const seriesPorProva: MateriaSerieProva[] = [];

  for (const exam of [...filtrados].reverse()) {
    const peso = pesoExam(exam, user?.metaProva, user?.vestibularAlvo);
    const materias: Record<string, number> = {};
    for (const q of exam.questionAttempts) {
      const mat =
        q.materiaId ??
        (q.provaQuestao
          ? mapMateriaAssuntoToTaxonomy(q.provaQuestao.materia, q.provaQuestao.assunto).materiaId
          : null);
      if (!mat) continue;

      const acc = materiaAcc.get(mat) ?? { acertos: 0, total: 0, erros: 0 };
      acc.total += peso;
      if (q.correto) acc.acertos += peso;
      else acc.erros += peso;
      materiaAcc.set(mat, acc);

      somaPeso += peso;
      somaPesoAcerto += (q.correto ? 1 : 0) * peso;
    }

    // por registro: % por matéria naquele exame
    const perExamMateria = new Map<string, { a: number; t: number }>();
    for (const q of exam.questionAttempts) {
      const mat =
        q.materiaId ??
        (q.provaQuestao
          ? mapMateriaAssuntoToTaxonomy(q.provaQuestao.materia, q.provaQuestao.assunto).materiaId
          : null);
      if (!mat) continue;
      const m = perExamMateria.get(mat) ?? { a: 0, t: 0 };
      m.t++;
      if (q.correto) m.a++;
      perExamMateria.set(mat, m);
    }
    const materiasPct: Record<string, number> = {};
    for (const [mid, s] of perExamMateria) {
      materiasPct[mid] = s.t > 0 ? Math.round((s.a / s.t) * 100) : 0;
    }

    seriesPorProva.push({
      examId: exam.id,
      nome: exam.nome,
      dataLabel: formatDataAplicacao(exam.data),
      pctGeral: pctAcertoRegistro(exam.questionAttempts),
      materias: materiasPct,
    });
  }

  const materiasMedia: MateriaMediaJornada[] = [...materiaAcc.entries()]
    .map(([materiaId, s]) => ({
      materiaId,
      label: getMateriaLabel(materiaId),
      pctAcerto: s.total > 0 ? Math.round((s.acertos / s.total) * 100) : 0,
      totalPonderado: Math.round(s.total * 10) / 10,
      errosPonderados: Math.round(s.erros * 10) / 10,
    }))
    .sort((a, b) => a.pctAcerto - b.pctAcerto);

  const materiaIdsOrdenados = materiasMedia.map((m) => m.materiaId);

  const registrosRecentes: RegistroDashboardCard[] = filtrados.slice(0, 8).map((e) => ({
    id: e.id,
    nome: e.nome,
    dataLabel: formatDataAplicacao(e.data),
    pct: pctAcertoRegistro(e.questionAttempts),
    modoUso: e.modoUso,
    categoria: categoriaDoRegistro(e),
    provaId: e.provaId,
  }));

  return {
    pctGlobalPonderado: somaPeso > 0 ? Math.round((somaPesoAcerto / somaPeso) * 100) : 0,
    totalRegistros: filtrados.length,
    materiasMedia,
    seriesPorProva,
    registrosRecentes,
    materiaIdsOrdenados,
  };
}

export function labelMetaJornada(metaProva?: string | null, vestibularAlvo?: string | null) {
  return textoMetaAluno(metaProva, vestibularAlvo);
}
