import type { PrismaClient } from "@/generated/prisma/client";
import {
  carregarCatalogoMateria,
  indexarEscopos,
} from "@/lib/conhecimento-catalog";
import {
  agregarBenchmark,
  classificarPorKeywords,
} from "@/lib/enem-classificar/heuristica";
import { triarMateriaNatureza } from "@/lib/enem-classificar/triagem-natureza";
import { CLASSIFICACAO_CONFIANCA_MIN } from "@/lib/enem-corpus-stats";

export type ClassificarCorpusOpts = {
  /** Se definido, restringe N2 a um assunto (modo piloto). Omitir = todos os assuntos Bio. */
  assuntoId?: string;
  ano?: number;
  limit?: number;
  persistir?: boolean;
  /** Só triagem Bio/Química/Física, sem N2 */
  soTriagem?: boolean;
};

export type ClassificarCorpusResultado = {
  processadas: number;
  classified: number;
  unclassified: number;
  review: number;
  pctClassified: number;
  topEscopos: Array<{ escopoId: string; count: number }>;
  triagem: { biologia: number; quimica: number; fisica: number; indefinida: number };
};

const LIMITE_MAX = 700;

/** Triagem Natureza → matéria; em Biologia, classifica N2 (catálogo fechado). */
export async function classificarCorpusEnem(
  prisma: PrismaClient,
  opts: ClassificarCorpusOpts = {}
): Promise<ClassificarCorpusResultado> {
  const catalog = carregarCatalogoMateria("biologia");
  const escopos = indexarEscopos(catalog);
  const confiancaMinima = catalog.regras?.confiancaMinima ?? CLASSIFICACAO_CONFIANCA_MIN;
  const limit = Math.min(opts.limit ?? 700, LIMITE_MAX);
  const persistir = opts.persistir ?? true;

  const questoes = await prisma.enemQuestaoCorpus.findMany({
    where: {
      disciplina: "ciencias_natureza",
      ...(opts.ano ? { ano: opts.ano } : {}),
    },
    select: {
      id: true,
      fonteId: true,
      numero: true,
      enunciadoMd: true,
      introducaoAlternativas: true,
    },
    orderBy: [{ ano: "desc" }, { numero: "asc" }],
    take: limit,
  });

  const resultados: Array<{ fonteId: string; resultado: ReturnType<typeof classificarPorKeywords> }> =
    [];
  const triagem = { biologia: 0, quimica: 0, fisica: 0, indefinida: 0 };

  for (const q of questoes) {
    const texto = [q.enunciadoMd, q.introducaoAlternativas].filter(Boolean).join("\n");
    const tri = triarMateriaNatureza(texto);

    if (tri.materia === "Biologia") triagem.biologia++;
    else if (tri.materia === "Química") triagem.quimica++;
    else if (tri.materia === "Física") triagem.fisica++;
    else triagem.indefinida++;

    if (persistir) {
      await prisma.enemQuestaoCorpus.update({
        where: { id: q.id },
        data: {
          materia: tri.materia,
          classificacaoVersao: "heuristica-v0.2",
        },
      });
    }

    if (opts.soTriagem || tri.materia !== "Biologia") {
      if (persistir && tri.materia !== "Biologia") {
        await prisma.enemQuestaoCorpus.update({
          where: { id: q.id },
          data: {
            conhecimentoEscopoId: null,
            conhecimentoDominioId: null,
            assunto: null,
            classificacaoConfianca: null,
          },
        });
      }
      continue;
    }

    const resultado = classificarPorKeywords(texto, escopos, {
      confiancaMinima,
      assuntoId: opts.assuntoId,
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
        },
      });
    } else if (persistir) {
      await prisma.enemQuestaoCorpus.update({
        where: { id: q.id },
        data: {
          conhecimentoEscopoId: null,
          conhecimentoDominioId: null,
          classificacaoConfianca: resultado.confianca || null,
        },
      });
    }
  }

  const bench = agregarBenchmark(resultados);
  return {
    processadas: questoes.length,
    classified: bench.classified,
    unclassified: bench.unclassified,
    review: bench.review,
    pctClassified:
      triagem.biologia > 0 ? Math.round((bench.classified / triagem.biologia) * 100) : 0,
    topEscopos: bench.topEscopos,
    triagem,
  };
}
