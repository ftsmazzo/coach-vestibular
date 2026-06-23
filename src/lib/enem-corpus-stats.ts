import type { PrismaClient } from "@/generated/prisma/client";
import {
  labelMateriaCorpus,
  prefixoCatalogoMateria,
  type MateriaCorpusId,
} from "@/lib/conhecimento-catalog";
import { whereCorpusMateria } from "@/lib/enem-corpus-materia";

export const ENEM_CORPUS_MINIMO = Number(process.env.ENEM_CORPUS_MIN ?? "2500");
export const CLASSIFICACAO_CONFIANCA_MIN = 0.35;

export type MateriaCorpusStats = {
  materiaId: MateriaCorpusId;
  materiaLabel: string;
  triadas: number;
  classificadas: number;
  pctClassificadas: number;
  fila: number;
  topEscopos: Array<{ escopoId: string; count: number }>;
};

export type EnemCorpusStats = {
  total: number;
  importCompleto: boolean;
  metaCorpus: number;
  pctImport: number;
  ultimaImportacao: string | null;
  classificadas: number;
  pctClassificadas: number;
  filaRevisao: number;
  natureza: {
    total: number;
    triagem: { biologia: number; quimica: number; fisica: number; indefinida: number };
  };
  linguagens: {
    total: number;
    trilhas: { portugues: number; ingles: number; espanhol: number };
  };
  materiaAtiva: MateriaCorpusStats;
  porDisciplina: Array<{ disciplina: string; count: number }>;
  porAno: Array<{ ano: number; count: number }>;
};

async function statsMateria(
  prisma: PrismaClient,
  materiaId: MateriaCorpusId
): Promise<MateriaCorpusStats> {
  const materiaLabel = labelMateriaCorpus(materiaId);
  const prefixo = prefixoCatalogoMateria(materiaId);
  const baseWhere = whereCorpusMateria(materiaId);

  const [triadas, classificadas, fila, topEscoposRaw] = await Promise.all([
    prisma.enemQuestaoCorpus.count({ where: baseWhere }),
    prisma.enemQuestaoCorpus.count({
      where: {
        ...baseWhere,
        conhecimentoEscopoId: { not: null, startsWith: `${prefixo}.` },
        classificacaoConfianca: { gte: CLASSIFICACAO_CONFIANCA_MIN },
      },
    }),
    prisma.enemQuestaoCorpus.count({
      where: {
        ...baseWhere,
        OR: [
          { conhecimentoEscopoId: null },
          { classificacaoConfianca: { lt: CLASSIFICACAO_CONFIANCA_MIN } },
          { NOT: { conhecimentoEscopoId: { startsWith: `${prefixo}.` } } },
        ],
      },
    }),
    prisma.enemQuestaoCorpus.groupBy({
      by: ["conhecimentoEscopoId"],
      where: {
        ...baseWhere,
        conhecimentoEscopoId: { startsWith: `${prefixo}.` },
      },
      _count: { _all: true },
      orderBy: { _count: { conhecimentoEscopoId: "desc" } },
      take: 10,
    }),
  ]);

  return {
    materiaId,
    materiaLabel,
    triadas,
    classificadas,
    pctClassificadas: triadas > 0 ? Math.round((classificadas / triadas) * 100) : 0,
    fila,
    topEscopos: topEscoposRaw
      .filter((t) => t.conhecimentoEscopoId)
      .map((t) => ({
        escopoId: t.conhecimentoEscopoId!,
        count: t._count._all,
      })),
  };
}

export async function obterStatsCorpusEnem(
  prisma: PrismaClient,
  materiaId: MateriaCorpusId = "biologia"
): Promise<EnemCorpusStats> {
  const [
    total,
    ultima,
    classificadas,
    filaRevisao,
    naturezaTotal,
    triBio,
    triQuim,
    triFis,
    triIndef,
    lingTotal,
    lingComum,
    lingEn,
    lingEs,
    materiaAtiva,
    porDisciplina,
    porAno,
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
        ],
      },
    }),
    prisma.enemQuestaoCorpus.count({ where: { disciplina: "ciencias_natureza" } }),
    prisma.enemQuestaoCorpus.count({ where: { materia: "Biologia" } }),
    prisma.enemQuestaoCorpus.count({ where: { materia: "Química" } }),
    prisma.enemQuestaoCorpus.count({ where: { materia: "Física" } }),
    prisma.enemQuestaoCorpus.count({
      where: { disciplina: "ciencias_natureza", materia: null },
    }),
    prisma.enemQuestaoCorpus.count({ where: { disciplina: "linguagens" } }),
    prisma.enemQuestaoCorpus.count({ where: { disciplina: "linguagens", idioma: "COMUM" } }),
    prisma.enemQuestaoCorpus.count({ where: { disciplina: "linguagens", idioma: "ingles" } }),
    prisma.enemQuestaoCorpus.count({ where: { disciplina: "linguagens", idioma: "espanhol" } }),
    statsMateria(prisma, materiaId),
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
    natureza: {
      total: naturezaTotal,
      triagem: {
        biologia: triBio,
        quimica: triQuim,
        fisica: triFis,
        indefinida: triIndef,
      },
    },
    linguagens: {
      total: lingTotal,
      trilhas: { portugues: lingComum, ingles: lingEn, espanhol: lingEs },
    },
    materiaAtiva: materiaAtiva,
    porDisciplina: porDisciplina.map((d) => ({
      disciplina: d.disciplina,
      count: d._count._all,
    })),
    porAno: porAno.map((a) => ({ ano: a.ano, count: a._count._all })),
  };
}

export type FilaEnemItem = {
  id: string;
  fonteId: string;
  ano: number;
  numero: number;
  disciplina: string;
  materia: string | null;
  escopoId: string | null;
  confianca: number | null;
  assunto: string | null;
  trecho: string | null;
};

/** Fila da matéria alvo sem N2 válido. */
export async function listarFilaRevisaoEnem(
  prisma: PrismaClient,
  materiaId: MateriaCorpusId = "biologia",
  limit = 20
): Promise<FilaEnemItem[]> {
  const prefixo = prefixoCatalogoMateria(materiaId);
  const baseWhere = whereCorpusMateria(materiaId);

  const rows = await prisma.enemQuestaoCorpus.findMany({
    where: {
      ...baseWhere,
      OR: [
        { conhecimentoEscopoId: null },
        { classificacaoConfianca: { lt: CLASSIFICACAO_CONFIANCA_MIN } },
        { NOT: { conhecimentoEscopoId: { startsWith: `${prefixo}.` } } },
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
      materia: true,
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
      materia: r.materia,
      escopoId: r.conhecimentoEscopoId,
      confianca: r.classificacaoConfianca,
      assunto: r.assunto,
      trecho: texto ? (texto.length > 180 ? `${texto.slice(0, 177)}…` : texto) : null,
    };
  });
}
