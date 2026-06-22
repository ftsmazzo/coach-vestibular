import type { PrismaClient } from "@/generated/prisma/client";

export const ENEM_CORPUS_MINIMO = Number(process.env.ENEM_CORPUS_MIN ?? "2500");
export const CLASSIFICACAO_CONFIANCA_MIN = 0.35;

export type EnemCorpusStats = {
  total: number;
  importCompleto: boolean;
  metaCorpus: number;
  pctImport: number;
  ultimaImportacao: string | null;
  classificadas: number;
  pctClassificadas: number;
  filaRevisao: number;
  porDisciplina: Array<{ disciplina: string; count: number }>;
  porAno: Array<{ ano: number; count: number }>;
  topEscopos: Array<{ escopoId: string; count: number }>;
};

export async function obterStatsCorpusEnem(prisma: PrismaClient): Promise<EnemCorpusStats> {
  const [
    total,
    ultima,
    classificadas,
    filaRevisao,
    porDisciplina,
    porAno,
    topEscoposRaw,
  ] = await Promise.all([
    prisma.enemQuestaoCorpus.count(),
    prisma.enemQuestaoCorpus.findFirst({
      orderBy: { importadoEm: "desc" },
      select: { importadoEm: true },
    }),
    prisma.enemQuestaoCorpus.count({
      where: {
        conhecimentoEscopoId: { not: null },
        classificacaoConfianca: { gte: CLASSIFICACAO_CONFIANCA_MIN },
      },
    }),
    prisma.enemQuestaoCorpus.count({
      where: {
        OR: [
          { conhecimentoEscopoId: null },
          { classificacaoConfianca: { lt: CLASSIFICACAO_CONFIANCA_MIN } },
          { classificacaoConfianca: null, conhecimentoEscopoId: { not: null } },
        ],
      },
    }),
    prisma.enemQuestaoCorpus.groupBy({
      by: ["disciplina"],
      _count: { _all: true },
      orderBy: { disciplina: "asc" },
    }),
    prisma.enemQuestaoCorpus.groupBy({
      by: ["ano"],
      _count: { _all: true },
      orderBy: { ano: "desc" },
    }),
    prisma.enemQuestaoCorpus.groupBy({
      by: ["conhecimentoEscopoId"],
      where: { conhecimentoEscopoId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { conhecimentoEscopoId: "desc" } },
      take: 10,
    }),
  ]);

  const metaCorpus = ENEM_CORPUS_MINIMO;

  return {
    total,
    importCompleto: total >= metaCorpus,
    metaCorpus,
    pctImport: metaCorpus > 0 ? Math.min(100, Math.round((total / metaCorpus) * 100)) : 0,
    ultimaImportacao: ultima?.importadoEm?.toISOString() ?? null,
    classificadas,
    pctClassificadas: total > 0 ? Math.round((classificadas / total) * 100) : 0,
    filaRevisao,
    porDisciplina: porDisciplina.map((d) => ({
      disciplina: d.disciplina,
      count: d._count._all,
    })),
    porAno: porAno.map((a) => ({ ano: a.ano, count: a._count._all })),
    topEscopos: topEscoposRaw
      .filter((t) => t.conhecimentoEscopoId)
      .map((t) => ({
        escopoId: t.conhecimentoEscopoId!,
        count: t._count._all,
      })),
  };
}

export type FilaEnemItem = {
  id: string;
  fonteId: string;
  ano: number;
  numero: number;
  disciplina: string;
  escopoId: string | null;
  confianca: number | null;
  assunto: string | null;
  trecho: string | null;
};

export async function listarFilaRevisaoEnem(
  prisma: PrismaClient,
  limit = 20
): Promise<FilaEnemItem[]> {
  const rows = await prisma.enemQuestaoCorpus.findMany({
    where: {
      disciplina: "ciencias_natureza",
      OR: [
        { conhecimentoEscopoId: null },
        { classificacaoConfianca: { lt: CLASSIFICACAO_CONFIANCA_MIN } },
      ],
    },
    orderBy: [{ ano: "desc" }, { numero: "asc" }],
    take: limit,
    select: {
      id: true,
      fonteId: true,
      ano: true,
      numero: true,
      disciplina: true,
      conhecimentoEscopoId: true,
      classificacaoConfianca: true,
      assunto: true,
      enunciadoMd: true,
      introducaoAlternativas: true,
    },
  });

  return rows.map((r) => {
    const texto = [r.enunciadoMd, r.introducaoAlternativas].filter(Boolean).join(" ");
    return {
      id: r.id,
      fonteId: r.fonteId,
      ano: r.ano,
      numero: r.numero,
      disciplina: r.disciplina,
      escopoId: r.conhecimentoEscopoId,
      confianca: r.classificacaoConfianca,
      assunto: r.assunto,
      trecho: texto ? (texto.length > 180 ? `${texto.slice(0, 177)}…` : texto) : null,
    };
  });
}
