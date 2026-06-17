import type { ModoUsoRegistro } from "@/generated/prisma/client";
import { AREAS_BLOCO, type AreaBlocoId } from "@/lib/areas-bloco";
import { prisma } from "@/lib/prisma";
import { formatDataAplicacao } from "@/lib/data-prova";
import { pctAcertoRegistro } from "@/lib/exam-stats";
import {
  areaBlocoIdDeAttempt,
  materiaIdDeAttempt,
  materiasNoExame,
  pctMateriaNoExame,
} from "@/lib/jornada-materia-stats";
import { pesoBancaParaMeta, textoMetaAluno } from "@/lib/meta-vestibular";
import { pesoModoUso } from "@/lib/modo-uso";
import { abreviarNomeProva } from "@/lib/prova-label";
import {
  categoriaDoRegistro,
  tipoAtividadeVisual,
  type CategoriaRegistro,
  type TipoAtividadeVisual,
} from "@/lib/prova-tipo";
import { type KpiExecucao, type PontoExecucao, serieKpiExecucoes, ultimoKpi } from "@/lib/kpi-evolucao";
import { getMateriaLabel } from "@/lib/taxonomy";
import {
  agruparUnidadesJornada,
  PROVA_SELECT_MULTIDIA,
  unidadeComoExam,
} from "@/lib/prova-multidia";

export interface MateriaMediaJornada {
  materiaId: string;
  label: string;
  pctAcerto: number;
  totalPonderado: number;
  errosPonderados: number;
  /** Questões reais (não ponderadas) — para filtrar ruído em gráficos/textos */
  totalQuestoes: number;
}

export interface AreaBlocoMediaJornada {
  areaId: AreaBlocoId;
  label: string;
  pctAcerto: number;
  totalQuestoes: number;
}

/** % por matéria só quando houve questão naquele registro (sem default 0). */
export interface MateriaSerieProva {
  examId: string;
  nome: string;
  nomeCurto: string;
  dataLabel: string;
  pctGeral: number;
  /** null = matéria não caiu nesta prova */
  materias: Record<string, number | null>;
  materiasPresentes: string[];
}

export interface DeltaMateriaVestibular {
  materiaId: string;
  label: string;
  pctAnterior: number;
  pctAtual: number;
  delta: number;
  questoesAnterior: number;
  questoesAtual: number;
}

export interface ComparativoVestibulares {
  anterior: { examId: string; label: string; dataLabel: string; pctGeral: number };
  atual: { examId: string; label: string; dataLabel: string; pctGeral: number };
  deltaGeral: number;
  /** Só matérias com questões nas duas aplicações */
  deltas: DeltaMateriaVestibular[];
  melhorias: DeltaMateriaVestibular[];
  quedas: DeltaMateriaVestibular[];
}

export interface RegistroDashboardCard {
  id: string;
  nome: string;
  dataLabel: string;
  pct: number;
  modoUso: ModoUsoRegistro;
  categoria: CategoriaRegistro;
  tipoAtividade: TipoAtividadeVisual;
  provaId: string | null;
}

export interface EvolucaoVestibularesKpi {
  serie: KpiExecucao[];
  ultima: KpiExecucao | null;
  chart: Array<{ nome: string; data: string; taxaAcerto: number }>;
}

export interface JornadaDashboardAnalytics {
  pctGlobalPonderado: number;
  totalRegistros: number;
  materiasMedia: MateriaMediaJornada[];
  areasBloco: AreaBlocoMediaJornada[];
  seriesPorProva: MateriaSerieProva[];
  comparativoVestibulares: ComparativoVestibulares | null;
  evolucaoVestibulares: EvolucaoVestibularesKpi | null;
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

export function buildComparativoDuasExecucoes(
  oficiais: Array<{
    id: string;
    nome: string;
    data: Date;
    questionAttempts: Parameters<typeof pctMateriaNoExame>[0];
  }>
): ComparativoVestibulares | null {
  if (oficiais.length < 2) return null;

  const anterior = oficiais[oficiais.length - 2]!;
  const atual = oficiais[oficiais.length - 1]!;

  const presentesAnterior = new Set(materiasNoExame(anterior.questionAttempts));
  const presentesAtual = new Set(materiasNoExame(atual.questionAttempts));
  const comuns = [...presentesAnterior].filter((m) => presentesAtual.has(m));

  const deltas: DeltaMateriaVestibular[] = [];
  for (const materiaId of comuns) {
    const pa = pctMateriaNoExame(anterior.questionAttempts, materiaId);
    const pb = pctMateriaNoExame(atual.questionAttempts, materiaId);
    if (!pa || !pb) continue;
    deltas.push({
      materiaId,
      label: getMateriaLabel(materiaId),
      pctAnterior: pa.pct,
      pctAtual: pb.pct,
      delta: pb.pct - pa.pct,
      questoesAnterior: pa.total,
      questoesAtual: pb.total,
    });
  }

  deltas.sort((a, b) => b.delta - a.delta);

  return {
    anterior: {
      examId: anterior.id,
      label: abreviarNomeProva(anterior.nome),
      dataLabel: formatDataAplicacao(anterior.data),
      pctGeral: pctAcertoRegistro(anterior.questionAttempts),
    },
    atual: {
      examId: atual.id,
      label: abreviarNomeProva(atual.nome),
      dataLabel: formatDataAplicacao(atual.data),
      pctGeral: pctAcertoRegistro(atual.questionAttempts),
    },
    deltaGeral:
      pctAcertoRegistro(atual.questionAttempts) - pctAcertoRegistro(anterior.questionAttempts),
    deltas,
    melhorias: deltas.filter((d) => d.delta >= 3),
    quedas: deltas.filter((d) => d.delta <= -3).sort((a, b) => a.delta - b.delta),
  };
}

export type JourneyLearningAggregate = Pick<
  JornadaDashboardAnalytics,
  "pctGlobalPonderado" | "totalRegistros" | "materiasMedia" | "registrosRecentes"
>;

export type JornadaAnalyticsOptions = {
  /** Home/copiloto: sem comparativo entre oficiais nem séries por prova */
  journeyOnly?: boolean;
};

/** Agregação JOURNEY — sem comparativos inválidos entre bancas/provas. */
export async function aggregateJourneyLearning(
  userId: string,
  filtro: "todos" | "provas" | "simulados" = "todos"
): Promise<JourneyLearningAggregate> {
  const full = await buildJornadaDashboardAnalytics(userId, filtro, { journeyOnly: true });
  return {
    pctGlobalPonderado: full.pctGlobalPonderado,
    totalRegistros: full.totalRegistros,
    materiasMedia: full.materiasMedia,
    registrosRecentes: full.registrosRecentes,
  };
}

export async function buildJornadaDashboardAnalytics(
  userId: string,
  filtro: "todos" | "provas" | "simulados" = "todos",
  options?: JornadaAnalyticsOptions
): Promise<JornadaDashboardAnalytics> {
  const journeyOnly = options?.journeyOnly ?? false;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { metaProva: true, vestibularAlvo: true },
  });

  const exams = await prisma.exam.findMany({
    where: { userId },
    orderBy: { data: "desc" },
    include: {
      questionAttempts: { include: { provaQuestao: true } },
      prova: { select: { ...PROVA_SELECT_MULTIDIA, tipo: true } },
    },
  });

  const { registroPassaFiltro } = await import("@/lib/prova-tipo");
  const unidades = agruparUnidadesJornada(exams);
  const filtradas = unidades.filter((u) => u.exames.some((e) => registroPassaFiltro(e, filtro)));

  const materiaAcc = new Map<
    string,
    { acertos: number; total: number; erros: number; questoes: number }
  >();
  const areaAcc = new Map<AreaBlocoId, { acertos: number; questoes: number }>();

  let somaPesoAcerto = 0;
  let somaPeso = 0;

  const seriesPorProva: MateriaSerieProva[] = [];

  for (const unidade of [...filtradas].reverse()) {
    const peso = pesoExam({ modoUso: unidade.modoUso }, user?.metaProva, user?.vestibularAlvo);
    const materiasPct: Record<string, number | null> = {};
    const presentes = journeyOnly ? [] : materiasNoExame(unidade.questionAttempts);

    for (const q of unidade.questionAttempts) {
      const mat = materiaIdDeAttempt(q);
      if (!mat) continue;

      const acc = materiaAcc.get(mat) ?? { acertos: 0, total: 0, erros: 0, questoes: 0 };
      acc.total += peso;
      acc.questoes += 1;
      if (q.correto) acc.acertos += peso;
      else acc.erros += peso;
      materiaAcc.set(mat, acc);

      somaPeso += peso;
      somaPesoAcerto += (q.correto ? 1 : 0) * peso;

      if (!journeyOnly) {
        const areaId = areaBlocoIdDeAttempt(q);
        if (areaId) {
          const aa = areaAcc.get(areaId) ?? { acertos: 0, questoes: 0 };
          aa.questoes += 1;
          if (q.correto) aa.acertos += 1;
          areaAcc.set(areaId, aa);
        }
      }
    }

    if (!journeyOnly) {
      for (const mid of presentes) {
        const stats = pctMateriaNoExame(unidade.questionAttempts, mid);
        materiasPct[mid] = stats?.pct ?? null;
      }

      seriesPorProva.push({
        examId: unidade.id,
        nome: unidade.nome,
        nomeCurto: abreviarNomeProva(unidade.nome),
        dataLabel: formatDataAplicacao(unidade.data),
        pctGeral: pctAcertoRegistro(unidade.questionAttempts),
        materias: materiasPct,
        materiasPresentes: presentes,
      });
    }
  }

  const materiasMedia: MateriaMediaJornada[] = [...materiaAcc.entries()]
    .filter(([, s]) => s.questoes > 0)
    .map(([materiaId, s]) => ({
      materiaId,
      label: getMateriaLabel(materiaId),
      pctAcerto: s.total > 0 ? Math.round((s.acertos / s.total) * 100) : 0,
      totalPonderado: Math.round(s.total * 10) / 10,
      errosPonderados: Math.round(s.erros * 10) / 10,
      totalQuestoes: s.questoes,
    }))
    .sort((a, b) => a.pctAcerto - b.pctAcerto);

  const areasBloco: AreaBlocoMediaJornada[] = AREAS_BLOCO.map((def) => {
    const s = areaAcc.get(def.id);
    if (!s || s.questoes === 0) {
      return {
        areaId: def.id,
        label: def.label,
        pctAcerto: 0,
        totalQuestoes: 0,
      };
    }
    return {
      areaId: def.id,
      label: def.label,
      pctAcerto: Math.round((s.acertos / s.questoes) * 100),
      totalQuestoes: s.questoes,
    };
  }).filter((a) => a.totalQuestoes > 0);

  const materiaIdsOrdenados = materiasMedia
    .slice()
    .sort((a, b) => b.totalQuestoes - a.totalQuestoes)
    .map((m) => m.materiaId);

  let comparativoVestibulares: ComparativoVestibulares | null = null;
  let evolucaoVestibulares: EvolucaoVestibularesKpi | null = null;

  if (!journeyOnly) {
    const oficiais = [...filtradas]
      .filter((u) => u.exames.some((e) => categoriaDoRegistro(e) === "prova_oficial"))
      .sort((a, b) => a.data.getTime() - b.data.getTime())
      .map((u) => unidadeComoExam(u));

    comparativoVestibulares = buildComparativoDuasExecucoes(oficiais);

    if (oficiais.length >= 1) {
      const pontos: PontoExecucao[] = oficiais.map((e) => ({
        id: e.id,
        label: abreviarNomeProva(e.nome),
        dataLabel: formatDataAplicacao(e.data),
        pct: pctAcertoRegistro(e.questionAttempts),
      }));
      const serie = serieKpiExecucoes(pontos);
      evolucaoVestibulares = {
        serie,
        ultima: ultimoKpi(serie),
        chart: pontos.map((p) => ({
          nome: p.label,
          data: p.dataLabel,
          taxaAcerto: p.pct,
        })),
      };
    }
  }

  const registrosRecentes: RegistroDashboardCard[] = filtradas.slice(0, 8).map((u) => {
    const e = unidadeComoExam(u);
    return {
      id: u.id,
      nome: u.nome,
      dataLabel: formatDataAplicacao(u.data),
      pct: pctAcertoRegistro(u.questionAttempts),
      modoUso: u.modoUso,
      categoria: categoriaDoRegistro(e),
      tipoAtividade: tipoAtividadeVisual(e),
      provaId: u.provaId,
    };
  });

  return {
    pctGlobalPonderado: somaPeso > 0 ? Math.round((somaPesoAcerto / somaPeso) * 100) : 0,
    totalRegistros: filtradas.length,
    materiasMedia,
    areasBloco,
    seriesPorProva,
    comparativoVestibulares,
    evolucaoVestibulares,
    registrosRecentes,
    materiaIdsOrdenados,
  };
}

export function labelMetaJornada(metaProva?: string | null, vestibularAlvo?: string | null) {
  return textoMetaAluno(metaProva, vestibularAlvo);
}

/** Matérias com dados suficientes para texto/gráficos (evita Sociologia 0% sem questão). */
export function materiasComDadosReais(
  materias: MateriaMediaJornada[],
  minQuestoes = 3
): MateriaMediaJornada[] {
  return materias.filter((m) => m.totalQuestoes >= minQuestoes);
}
