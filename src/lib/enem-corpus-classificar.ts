import type { PrismaClient } from "@/generated/prisma/client";
import {
  carregarCatalogoMateria,
  indexarEscopos,
} from "@/lib/conhecimento-catalog";
import {
  classificarLoteIA,
  iaClassificacaoDisponivel,
} from "@/lib/enem-classificar/classificar-ia";
import {
  agregarBenchmark,
  classificarPorKeywords,
} from "@/lib/enem-classificar/heuristica";
import { triarMateriaNatureza } from "@/lib/enem-classificar/triagem-natureza";
import { CLASSIFICACAO_CONFIANCA_MIN } from "@/lib/enem-corpus-stats";
import type { ResultadoClassificacao } from "@/lib/conhecimento-catalog/types";

export type ClassificarCorpusOpts = {
  assuntoId?: string;
  ano?: number;
  limit?: number;
  persistir?: boolean;
  soTriagem?: boolean;
  /** heuristica (rápido) ou ia (OpenAI — recomendado) */
  modo?: "heuristica" | "ia";
};

export type ClassificarCorpusResultado = {
  processadas: number;
  classified: number;
  unclassified: number;
  review: number;
  pctClassified: number;
  topEscopos: Array<{ escopoId: string; count: number }>;
  triagem: { biologia: number; quimica: number; fisica: number; indefinida: number };
  modo: "heuristica" | "ia";
};

const LIMITE_MAX = 700;
const LOTE_IA = 8;

function persistirResultado(
  prisma: PrismaClient,
  id: string,
  resultado: ResultadoClassificacao,
  versao: string
) {
  const temN2 =
    (resultado.status === "classified" || resultado.status === "review") &&
    resultado.escopoId;

  return prisma.enemQuestaoCorpus.update({
    where: { id },
    data: temN2
      ? {
          materia: "Biologia",
          assunto: resultado.assuntoId,
          conhecimentoDominioId: resultado.dominioId,
          conhecimentoEscopoId: resultado.escopoId,
          classificacaoConfianca: resultado.confianca,
          classificacaoVersao: versao,
        }
      : {
          conhecimentoEscopoId: null,
          conhecimentoDominioId: null,
          classificacaoConfianca: resultado.confianca || null,
          classificacaoVersao: "heuristica-v1",
        },
  });
}

export async function classificarCorpusEnem(
  prisma: PrismaClient,
  opts: ClassificarCorpusOpts = {}
): Promise<ClassificarCorpusResultado> {
  const catalog = carregarCatalogoMateria("biologia");
  const escopos = indexarEscopos(catalog);
  const confiancaMinima = catalog.regras?.confiancaMinima ?? CLASSIFICACAO_CONFIANCA_MIN;
  const limit = Math.min(opts.limit ?? 700, LIMITE_MAX);
  const persistir = opts.persistir ?? true;
  const modo =
    opts.modo === "ia" && iaClassificacaoDisponivel() ? "ia" : "heuristica";

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

  const triagem = { biologia: 0, quimica: 0, fisica: 0, indefinida: 0 };
  const bioParaClassificar: Array<{
    id: string;
    fonteId: string;
    texto: string;
  }> = [];

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
        data: { materia: tri.materia },
      });
    }

    if (!opts.soTriagem && tri.materia === "Biologia") {
      bioParaClassificar.push({ id: q.id, fonteId: q.fonteId, texto });
    } else if (persistir && tri.materia !== "Biologia") {
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
  }

  const resultados: Array<{ fonteId: string; resultado: ResultadoClassificacao }> = [];

  if (!opts.soTriagem && bioParaClassificar.length > 0) {
    if (modo === "ia") {
      for (let i = 0; i < bioParaClassificar.length; i += LOTE_IA) {
        const lote = bioParaClassificar.slice(i, i + LOTE_IA);
        const mapa = await classificarLoteIA(
          lote.map((q) => ({ fonteId: q.fonteId, texto: q.texto })),
          escopos
        );
        for (const q of lote) {
          let resultado = mapa.get(q.fonteId)!;
          resultado.motivo = `IA: ${resultado.motivo}`;

          if (resultado.status === "unclassified") {
            const fallback = classificarPorKeywords(q.texto, escopos, {
              confiancaMinima,
              assuntoId: opts.assuntoId,
            });
            if (fallback.status !== "unclassified" && fallback.escopoId) {
              resultado = {
                ...fallback,
                motivo: `fallback keywords: ${fallback.motivo}`,
              };
            }
          }

          resultados.push({ fonteId: q.fonteId, resultado });
          if (persistir) await persistirResultado(prisma, q.id, resultado, "ia-v1");
        }
      }
    } else {
      for (const q of bioParaClassificar) {
        const resultado = classificarPorKeywords(q.texto, escopos, {
          confiancaMinima,
          assuntoId: opts.assuntoId,
        });
        resultados.push({ fonteId: q.fonteId, resultado });
        if (persistir) await persistirResultado(prisma, q.id, resultado, "heuristica-v1");
      }
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
    modo,
  };
}
