import type { ErrorType } from "@/generated/prisma/client";
import { aggregateJourneyLearning } from "@/lib/jornada-analytics";
import { pesoModoUso } from "@/lib/modo-uso";
import { pesoBancaParaMeta } from "@/lib/meta-vestibular";
import { prisma } from "@/lib/prisma";
import { getTipoErroLabel } from "@/lib/taxonomy";
import {
  agruparPorTipoCognitivo,
  inferirTipoCognitivo,
  materiaCoincide,
  type CausaErroLacuna,
  type ClusterCognitivo,
  type TipoCognitivoId,
} from "@/lib/tipo-cognitivo";

export type LacunaConhecimento = {
  chave: string;
  texto: string;
  materia: string | null;
  materiaId: string | null;
  tipoCognitivo: TipoCognitivoId;
  tipoCognitivoLabel: string;
  erros: number;
  errosPonderados: number;
  scoreImpacto: number;
  numeros: number[];
  causaDominante: CausaErroLacuna | null;
  pctAcertoMateria: number | null;
};

export type { ClusterCognitivo };

function normalizarConhecimento(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .slice(0, 220);
}

function normMateria(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "");
}

function mapaDeficitMaterias(
  materias: Array<{ materiaId: string; label: string; pctAcerto: number; totalQuestoes: number }>
): Map<string, { pct: number; label: string; gap: number }> {
  const map = new Map<string, { pct: number; label: string; gap: number }>();
  for (const m of materias) {
    if (m.totalQuestoes < 2) continue;
    const gap = Math.max(0, 100 - m.pctAcerto);
    map.set(normMateria(m.label), { pct: m.pctAcerto, label: m.label, gap });
    map.set(m.materiaId, { pct: m.pctAcerto, label: m.label, gap });
  }
  return map;
}

function deficitMateria(
  materiaNome: string | null,
  mapa: Map<string, { pct: number; label: string; gap: number }>
): { pct: number | null; gap: number } {
  if (!materiaNome) return { pct: null, gap: 40 };
  const n = normMateria(materiaNome);
  for (const [key, v] of mapa) {
    if (normMateria(key) === n || n.includes(normMateria(key)) || normMateria(key).includes(n)) {
      return { pct: v.pct, gap: v.gap };
    }
  }
  return { pct: null, gap: 40 };
}

function causaComPct(causas: Map<ErrorType, number>): CausaErroLacuna | null {
  const sorted = [...causas.entries()].sort((a, b) => b[1] - a[1]);
  const top = sorted[0];
  if (!top) return null;
  const total = sorted.reduce((s, [, c]) => s + c, 0);
  return {
    tipo: top[0],
    label: getTipoErroLabel(top[0]) ?? top[0],
    count: top[1],
    pct: total > 0 ? Math.round((top[1] / total) * 100) : 0,
  };
}

/** Lacunas por conhecimento — prioridade por déficit na matéria, não só volume de erros. */
export async function aggregateKnowledgeGaps(
  userId: string,
  limit = 8
): Promise<LacunaConhecimento[]> {
  const [user, journey, exams] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { metaProva: true, vestibularAlvo: true },
    }),
    aggregateJourneyLearning(userId, "todos"),
    prisma.exam.findMany({
      where: { userId },
      orderBy: { data: "desc" },
      take: 20,
      select: {
        modoUso: true,
        banca: true,
        questionAttempts: {
          where: { correto: false },
          select: {
            numero: true,
            tipoErro: true,
            materiaId: true,
            provaQuestao: {
              select: { conhecimentoExigido: true, materia: true },
            },
          },
        },
      },
    }),
  ]);

  const mapaDeficit = mapaDeficitMaterias(journey.materiasMedia);

  const map = new Map<
    string,
    LacunaConhecimento & { _causas: Map<ErrorType, number> }
  >();

  for (const exam of exams) {
    const pesoExam =
      pesoModoUso(exam.modoUso) *
      pesoBancaParaMeta(exam.banca, user?.metaProva, user?.vestibularAlvo);

    for (const a of exam.questionAttempts) {
      const raw = a.provaQuestao?.conhecimentoExigido?.trim();
      if (!raw || raw.length < 8) continue;

      const chave = normalizarConhecimento(raw);
      const tipo = inferirTipoCognitivo(raw);
      const materiaNome = a.provaQuestao?.materia?.trim() || null;
      const { pct: pctMat, gap: gapMat } = deficitMateria(materiaNome, mapaDeficit);

      const entry =
        map.get(chave) ??
        ({
          chave,
          texto: raw.length > 160 ? `${raw.slice(0, 157)}…` : raw,
          materia: materiaNome,
          materiaId: a.materiaId,
          tipoCognitivo: tipo.id,
          tipoCognitivoLabel: tipo.id === "outro" ? "Demanda específica" : tipo.label,
          erros: 0,
          errosPonderados: 0,
          scoreImpacto: 0,
          numeros: [],
          causaDominante: null,
          pctAcertoMateria: pctMat,
          _causas: new Map(),
        } as LacunaConhecimento & { _causas: Map<ErrorType, number> });

      entry.erros += 1;
      entry.errosPonderados += pesoExam;
      const fatorDeficit = 1 + gapMat / 35;
      entry.scoreImpacto += pesoExam * fatorDeficit;

      if (a.tipoErro) {
        entry._causas.set(a.tipoErro, (entry._causas.get(a.tipoErro) ?? 0) + 1);
      }
      if (a.numero && !entry.numeros.includes(a.numero) && entry.numeros.length < 6) {
        entry.numeros.push(a.numero);
      }
      map.set(chave, entry);
    }
  }

  return [...map.values()]
    .map(({ _causas, ...rest }) => {
      const causa = causaComPct(_causas);
      return {
        ...rest,
        causaDominante: causa
          ? { tipo: causa.tipo, label: causa.label, count: causa.count }
          : null,
      };
    })
    .sort((a, b) => b.scoreImpacto - a.scoreImpacto || b.erros - a.erros)
    .slice(0, limit);
}

export async function aggregateCognitiveClusters(
  userId: string,
  limit = 4
): Promise<ClusterCognitivo[]> {
  const lacunas = await aggregateKnowledgeGaps(userId, 32);
  const clusters = agruparPorTipoCognitivo(lacunas);

  for (const c of clusters) {
    if (c.causaDominante) {
      c.causaDominante.label =
        getTipoErroLabel(c.causaDominante.tipo) ?? c.causaDominante.tipo;
    }
  }

  return clusters.slice(0, limit);
}

/** Lacuna prioritária: maior impacto na matéria com pior %. */
export function escolherLacunaPrioritaria(
  lacunas: LacunaConhecimento[],
  materiaDeficitLabel: string | null
): LacunaConhecimento | null {
  if (lacunas.length === 0) return null;
  if (materiaDeficitLabel) {
    const naMateria = lacunas.filter((l) => l.materia && materiaCoincide(l.materia, materiaDeficitLabel));
    if (naMateria.length > 0) return naMateria[0]!;
  }
  return lacunas[0]!;
}

export function labelMateriaDeficit(
  materias: Array<{ label: string; pctAcerto: number; totalQuestoes: number }>
): { label: string; pct: number } | null {
  const candidatas = materias.filter((m) => m.totalQuestoes >= 3);
  if (candidatas.length === 0) return null;
  const pior = [...candidatas].sort((a, b) => a.pctAcerto - b.pctAcerto)[0]!;
  return { label: pior.label, pct: pior.pctAcerto };
}
