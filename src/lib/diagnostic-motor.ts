/**
 * Motor de inferência pedagógica — estatística e clusters ANTES da narrativa.
 * A IA (texto) entra no final; o headline nunca é conhecimento bruto de uma questão.
 */
import type { ErrorType } from "@/generated/prisma/client";
import { aggregateJourneyLearning } from "@/lib/jornada-analytics";
import { pesoModoUso } from "@/lib/modo-uso";
import { pesoBancaParaMeta } from "@/lib/meta-vestibular";
import { prisma } from "@/lib/prisma";
import { getTipoErroLabel } from "@/lib/taxonomy";
import {
  CLUSTERS_PEDAGOGICOS,
  classificarClusterPedagogico,
  padraoMetacognitivoCluster,
  type PedagogicalClusterId,
} from "@/lib/pedagogical-clusters";

export type EventoErroPedagogico = {
  examId: string;
  examData: Date;
  numero: number;
  peso: number;
  conhecimentoBruto: string;
  materia: string | null;
  assunto: string | null;
  tipoErro: ErrorType | null;
  clusterId: PedagogicalClusterId;
};

export type ClusterAgregado = {
  clusterId: PedagogicalClusterId;
  label: string;
  operacaoCognitiva: string;
  diagnosticoAbstrato: string;
  erros: number;
  errosPonderados: number;
  priorityScore: number;
  recorrencia: number;
  persistencia: number;
  impactoNota: number;
  materias: Array<{ nome: string; erros: number; pctAcerto: number | null }>;
  causaDominante: { tipo: ErrorType; label: string; pct: number } | null;
  padraoMetacognitivo: string | null;
  /** Evidências (micro) — não são o diagnóstico */
  evidencias: string[];
};

export type DiagnosticoMotor = {
  temDados: boolean;
  clusterPrincipal: ClusterAgregado | null;
  clusters: ClusterAgregado[];
  materiaDeficit: { label: string; pct: number } | null;
  totalExames: number;
};

function normMateria(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function materiaCoincide(a: string, b: string): boolean {
  const na = normMateria(a);
  const nb = normMateria(b);
  return na.includes(nb) || nb.includes(na);
}

export async function coletarEventosErro(userId: string): Promise<EventoErroPedagogico[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { metaProva: true, vestibularAlvo: true },
  });

  const exams = await prisma.exam.findMany({
    where: { userId },
    orderBy: { data: "desc" },
    take: 24,
    select: {
      id: true,
      data: true,
      modoUso: true,
      banca: true,
      questionAttempts: {
        where: { correto: false },
        select: {
          numero: true,
          tipoErro: true,
          provaQuestao: {
            select: {
              conhecimentoExigido: true,
              materia: true,
              assunto: true,
            },
          },
        },
      },
    },
  });

  const eventos: EventoErroPedagogico[] = [];

  for (const exam of exams) {
    const pesoBase =
      pesoModoUso(exam.modoUso) *
      pesoBancaParaMeta(exam.banca, user?.metaProva, user?.vestibularAlvo);

    for (const a of exam.questionAttempts) {
      const raw = a.provaQuestao?.conhecimentoExigido?.trim();
      if (!raw || raw.length < 8) continue;

      const materia = a.provaQuestao?.materia?.trim() || null;
      const assunto = a.provaQuestao?.assunto?.trim() || null;

      eventos.push({
        examId: exam.id,
        examData: exam.data,
        numero: a.numero,
        peso: pesoBase,
        conhecimentoBruto: raw,
        materia,
        assunto,
        tipoErro: a.tipoErro,
        clusterId: classificarClusterPedagogico(raw, materia, assunto),
      });
    }
  }

  return eventos;
}

function calcularPriorityScore(input: {
  errosPonderados: number;
  recorrencia: number;
  persistencia: number;
  impactoNota: number;
  incidenciaMeta: number;
  dominioAtual: number;
  boostMateriaDeficit: number;
  penalidadeMicro: number;
}): number {
  const base =
    input.errosPonderados *
    (1 + input.recorrencia * 0.85) *
    (1 + input.persistencia * 0.5) *
    (1 + input.impactoNota / 45) *
    input.incidenciaMeta;

  const penalidade = input.dominioAtual / 120 + input.penalidadeMicro;

  return base * input.boostMateriaDeficit - penalidade;
}

export function agregarClustersPedagogicos(
  eventos: EventoErroPedagogico[],
  opts: {
    totalExames: number;
    materiaDeficit: { label: string; pct: number } | null;
    gapPorMateria: Map<string, number>;
    pctPorMateria: Map<string, number>;
  }
): ClusterAgregado[] {
  const map = new Map<
    PedagogicalClusterId,
    {
      erros: number;
      errosPonderados: number;
      examIds: Set<string>;
      materias: Map<string, number>;
      causas: Map<ErrorType, number>;
      evidencias: string[];
      pesoIncidencia: number;
    }
  >();

  for (const e of eventos) {
    const agg =
      map.get(e.clusterId) ??
      ({
        erros: 0,
        errosPonderados: 0,
        examIds: new Set(),
        materias: new Map(),
        causas: new Map(),
        evidencias: [],
        pesoIncidencia: 0,
      } as const);

    const entry = {
      erros: agg.erros + 1,
      errosPonderados: agg.errosPonderados + e.peso,
      examIds: new Set(agg.examIds).add(e.examId),
      materias: new Map(agg.materias),
      causas: new Map(agg.causas),
      evidencias: [...agg.evidencias],
      pesoIncidencia: agg.pesoIncidencia + e.peso,
    };

    if (e.materia) {
      entry.materias.set(e.materia, (entry.materias.get(e.materia) ?? 0) + 1);
    }
    if (e.tipoErro) {
      entry.causas.set(e.tipoErro, (entry.causas.get(e.tipoErro) ?? 0) + 1);
    }
    if (entry.evidencias.length < 2 && e.conhecimentoBruto.length >= 12) {
      entry.evidencias.push(
        e.conhecimentoBruto.length > 100
          ? `${e.conhecimentoBruto.slice(0, 97)}…`
          : e.conhecimentoBruto
      );
    }

    map.set(e.clusterId, entry);
  }

  const totalExames = Math.max(1, opts.totalExames);

  const clusters: ClusterAgregado[] = [];

  for (const [clusterId, agg] of map) {
    const def = CLUSTERS_PEDAGOGICOS[clusterId];

    const materiasList = [...agg.materias.entries()]
      .map(([nome, erros]) => ({
        nome,
        erros,
        pctAcerto: opts.pctPorMateria.get(normMateria(nome)) ?? null,
      }))
      .sort((a, b) => b.erros - a.erros);

    let impactoNota = 0;
    let dominioSoma = 0;
    let dominioN = 0;
    for (const m of materiasList) {
      const gap = opts.gapPorMateria.get(normMateria(m.nome)) ?? 50;
      impactoNota += gap * m.erros;
      if (m.pctAcerto != null) {
        dominioSoma += m.pctAcerto;
        dominioN++;
      }
    }
    impactoNota = materiasList.length > 0 ? impactoNota / materiasList.length : 50;
    const dominioAtual = dominioN > 0 ? dominioSoma / dominioN : 50;

    const recorrencia = agg.examIds.size / totalExames;
    const persistencia = Math.min(1, agg.examIds.size / 3);

    const incidenciaMeta = agg.pesoIncidencia / Math.max(agg.erros, 1);

    let boostMateriaDeficit = 1;
    if (opts.materiaDeficit) {
      const errosNaDeficit = materiasList
        .filter((m) => materiaCoincide(m.nome, opts.materiaDeficit!.label))
        .reduce((s, m) => s + m.erros, 0);
      if (errosNaDeficit >= 2 || errosNaDeficit / agg.erros >= 0.35) {
        boostMateriaDeficit = 1.65;
      }
    }

    const penalidadeMicro =
      clusterId === "analise_linguistica" && agg.erros <= 5 && impactoNota < 55 ? 8 : 0;

    const priorityScore = calcularPriorityScore({
      errosPonderados: agg.errosPonderados,
      recorrencia,
      persistencia,
      impactoNota,
      incidenciaMeta,
      dominioAtual,
      boostMateriaDeficit,
      penalidadeMicro,
    });

    const causasSorted = [...agg.causas.entries()].sort((a, b) => b[1] - a[1]);
    const topCausa = causasSorted[0];
    const totalCausas = causasSorted.reduce((s, [, c]) => s + c, 0);
    const causaDominante = topCausa
      ? {
          tipo: topCausa[0],
          label: getTipoErroLabel(topCausa[0]) ?? topCausa[0],
          pct: totalCausas > 0 ? Math.round((topCausa[1] / totalCausas) * 100) : 0,
        }
      : null;

    clusters.push({
      clusterId,
      label: def.label,
      operacaoCognitiva: def.operacaoCognitiva,
      diagnosticoAbstrato: def.diagnosticoAbstrato,
      erros: agg.erros,
      errosPonderados: Math.round(agg.errosPonderados * 10) / 10,
      priorityScore: Math.round(priorityScore * 10) / 10,
      recorrencia: Math.round(recorrencia * 100),
      persistencia: Math.round(persistencia * 100),
      impactoNota: Math.round(impactoNota),
      materias: materiasList.slice(0, 4),
      causaDominante,
      padraoMetacognitivo: padraoMetacognitivoCluster(
        causaDominante?.tipo ?? null,
        causaDominante?.pct ?? null
      ),
      evidencias: agg.evidencias,
    });
  }

  return clusters.sort((a, b) => b.priorityScore - a.priorityScore);
}

export function narrativaDiagnostico(
  principal: ClusterAgregado,
  materiaDeficit: { label: string; pct: number } | null
): { titulo: string; paragrafo: string } {
  const partes: string[] = [];

  if (materiaDeficit) {
    const errosNaDeficit = principal.materias
      .filter((m) => materiaCoincide(m.nome, materiaDeficit.label))
      .reduce((s, m) => s + m.erros, 0);
    if (errosNaDeficit > 0 || principal.impactoNota >= 50) {
      partes.push(
        `Seu maior déficit curricular hoje é ${materiaDeficit.label} (${materiaDeficit.pct}% de acerto na jornada).`
      );
    }
  }

  partes.push(principal.diagnosticoAbstrato);

  if (principal.padraoMetacognitivo) {
    partes.push(principal.padraoMetacognitivo);
  }

  const ctx = principal.materias
    .slice(0, 2)
    .map((m) => m.nome)
    .join(" e ");
  if (ctx) {
    partes.push(
      `Esse padrão aparece com mais peso em ${ctx} (${principal.erros} erro${principal.erros !== 1 ? "s" : ""} no cluster, recorrência em ${principal.recorrencia}% dos registros).`
    );
  }

  if (principal.evidencias.length > 0) {
    partes.push(
      `Exemplo do que a banca cobrou (evidência, não é o eixo inteiro): «${principal.evidencias[0]}».`
    );
  }

  return {
    titulo: `${principal.label} — ${principal.operacaoCognitiva}`,
    paragrafo: partes.join(" "),
  };
}

export async function buildDiagnosticoMotor(userId: string): Promise<DiagnosticoMotor> {
  const [eventos, journey, totalExames] = await Promise.all([
    coletarEventosErro(userId),
    aggregateJourneyLearning(userId, "todos"),
    prisma.exam.count({ where: { userId } }),
  ]);

  if (eventos.length === 0) {
    return {
      temDados: false,
      clusterPrincipal: null,
      clusters: [],
      materiaDeficit: null,
      totalExames,
    };
  }

  const gapPorMateria = new Map<string, number>();
  const pctPorMateria = new Map<string, number>();
  let materiaDeficit: { label: string; pct: number } | null = null;

  const candidatas = journey.materiasMedia.filter((m) => m.totalQuestoes >= 3);
  if (candidatas.length > 0) {
    const pior = [...candidatas].sort((a, b) => a.pctAcerto - b.pctAcerto)[0]!;
    materiaDeficit = { label: pior.label, pct: pior.pctAcerto };
    for (const m of candidatas) {
      gapPorMateria.set(normMateria(m.label), Math.max(0, 100 - m.pctAcerto));
      pctPorMateria.set(normMateria(m.label), m.pctAcerto);
    }
  }

  const clusters = agregarClustersPedagogicos(eventos, {
    totalExames,
    materiaDeficit,
    gapPorMateria,
    pctPorMateria,
  });

  return {
    temDados: true,
    clusterPrincipal: clusters[0] ?? null,
    clusters,
    materiaDeficit,
    totalExames,
  };
}
