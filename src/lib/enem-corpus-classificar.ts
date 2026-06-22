import type { PrismaClient } from "@/generated/prisma/client";
import {
  carregarCatalogoMateria,
  indexarEscopos,
} from "@/lib/conhecimento-catalog";
import {
  agregarBenchmark,
  classificarPorKeywords,
} from "@/lib/enem-classificar/heuristica";
import { CLASSIFICACAO_CONFIANCA_MIN } from "@/lib/enem-corpus-stats";

export type ClassificarCorpusOpts = {
  assuntoId?: string;
  ano?: number;
  limit?: number;
  persistir?: boolean;
};

export type ClassificarCorpusResultado = {
  processadas: number;
  classified: number;
  unclassified: number;
  review: number;
  pctClassified: number;
  topEscopos: Array<{ escopoId: string; count: number }>;
};

const LIMITE_MAX = 500;

/** Classificação heurística piloto — só persiste quando status === classified. */
export async function classificarCorpusEnem(
  prisma: PrismaClient,
  opts: ClassificarCorpusOpts = {}
): Promise<ClassificarCorpusResultado> {
  const catalog = carregarCatalogoMateria("biologia");
  const escopos = indexarEscopos(catalog);
  const confiancaMinima = catalog.regras?.confiancaMinima ?? CLASSIFICACAO_CONFIANCA_MIN;
  const assuntoId = opts.assuntoId ?? "ecologia";
  const limit = Math.min(opts.limit ?? 200, LIMITE_MAX);
  const persistir = opts.persistir ?? true;

  const questoes = await prisma.enemQuestaoCorpus.findMany({
    where: {
      disciplina: "ciencias_natureza",
      ...(opts.ano ? { ano: opts.ano } : {}),
    },
    select: {
      id: true,
      fonteId: true,
      enunciadoMd: true,
      introducaoAlternativas: true,
    },
    orderBy: [{ ano: "desc" }, { numero: "asc" }],
    take: limit,
  });

  const resultados: Array<{ fonteId: string; resultado: ReturnType<typeof classificarPorKeywords> }> =
    [];

  for (const q of questoes) {
    const texto = [q.enunciadoMd, q.introducaoAlternativas].filter(Boolean).join("\n");
    const resultado = classificarPorKeywords(texto, escopos, {
      confiancaMinima,
      assuntoId,
    });
    resultados.push({ fonteId: q.fonteId, resultado });

    if (persistir && resultado.status === "classified" && resultado.escopoId) {
      await prisma.enemQuestaoCorpus.update({
        where: { id: q.id },
        data: {
          materia: "Biologia",
          assunto: resultado.assuntoId,
          conhecimentoDominioId: resultado.dominioId,
          conhecimentoEscopoId: resultado.escopoId,
          classificacaoConfianca: resultado.confianca,
          classificacaoVersao: "heuristica-v0.1",
        },
      });
    } else if (persistir && resultado.status === "unclassified") {
      await prisma.enemQuestaoCorpus.update({
        where: { id: q.id },
        data: {
          conhecimentoEscopoId: null,
          conhecimentoDominioId: null,
          classificacaoConfianca: resultado.confianca || null,
          classificacaoVersao: "heuristica-v0.1",
        },
      });
    }
  }

  const bench = agregarBenchmark(resultados);
  return {
    processadas: bench.total,
    classified: bench.classified,
    unclassified: bench.unclassified,
    review: bench.review,
    pctClassified: bench.pctClassified,
    topEscopos: bench.topEscopos,
  };
}
