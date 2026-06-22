import type { PrismaClient } from "@/generated/prisma/client";
import {
  carregarCatalogoMateria,
  indexarEscopos,
  labelMateriaCorpus,
  prefixoCatalogoMateria,
  type MateriaCorpusId,
} from "@/lib/conhecimento-catalog";
import {
  classificarLoteIA,
  iaClassificacaoDisponivel,
} from "@/lib/enem-classificar/classificar-ia";
import {
  agregarBenchmark,
  classificarPorKeywords,
} from "@/lib/enem-classificar/heuristica";
import {
  mesclarTriagem,
  precisaTriagemIA,
  triarLoteIA,
} from "@/lib/enem-classificar/triagem-ia";
import {
  triarMateriaNatureza,
  type TriagemNatureza,
} from "@/lib/enem-classificar/triagem-natureza";
import { CLASSIFICACAO_CONFIANCA_MIN } from "@/lib/enem-corpus-stats";
import type { ResultadoClassificacao } from "@/lib/conhecimento-catalog/types";

export type ClassificarCorpusOpts = {
  /** Matéria alvo dentro de Natureza (biologia | quimica | fisica) */
  materiaId?: MateriaCorpusId;
  assuntoId?: string;
  ano?: number;
  limit?: number;
  persistir?: boolean;
  soTriagem?: boolean;
  /** Reexecuta triagem Bio/Quím/Fís (default: false — usa triagem já persistida) */
  retriagem?: boolean;
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
  triagemIa: number;
  materiaProcessadas: number;
  materiaId: MateriaCorpusId;
  modo: "heuristica" | "ia";
};

const LIMITE_MAX = 700;
const LOTE_IA = 8;
const LOTE_TRIAGEM_IA = 10;

function persistirResultado(
  prisma: PrismaClient,
  id: string,
  resultado: ResultadoClassificacao,
  versao: string,
  materiaLabel: string
) {
  const temN2 =
    (resultado.status === "classified" || resultado.status === "review") &&
    resultado.escopoId;

  return prisma.enemQuestaoCorpus.update({
    where: { id },
    data: temN2
      ? {
          materia: materiaLabel,
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
          classificacaoVersao: versao,
        },
  });
}

function contarTriagem(triagem: ClassificarCorpusResultado["triagem"], materia: TriagemNatureza["materia"]) {
  if (materia === "Biologia") triagem.biologia++;
  else if (materia === "Química") triagem.quimica++;
  else if (materia === "Física") triagem.fisica++;
  else triagem.indefinida++;
}

export async function classificarCorpusEnem(
  prisma: PrismaClient,
  opts: ClassificarCorpusOpts = {}
): Promise<ClassificarCorpusResultado> {
  const materiaId = opts.materiaId ?? "biologia";
  const materiaLabel = labelMateriaCorpus(materiaId);
  const prefixoN2 = prefixoCatalogoMateria(materiaId);
  const catalog = carregarCatalogoMateria(materiaId);
  const escopos = indexarEscopos(catalog);
  const confiancaMinima = catalog.regras?.confiancaMinima ?? CLASSIFICACAO_CONFIANCA_MIN;
  const limit = Math.min(opts.limit ?? 700, LIMITE_MAX);
  const persistir = opts.persistir ?? true;
  const retriagem = opts.retriagem ?? false;
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
      materia: true,
      conhecimentoEscopoId: true,
      classificacaoConfianca: true,
    },
    orderBy: [{ ano: "desc" }, { numero: "asc" }],
    take: limit,
  });

  type Item = {
    id: string;
    fonteId: string;
    texto: string;
    materiaDb: string | null;
    triHeur: TriagemNatureza;
    triFinal: TriagemNatureza;
    conhecimentoEscopoId: string | null;
    classificacaoConfianca: number | null;
  };

  const itens: Item[] = questoes.map((q) => {
    const texto = [q.enunciadoMd, q.introducaoAlternativas].filter(Boolean).join("\n");
    const triHeur = triarMateriaNatureza(texto);
    return {
      id: q.id,
      fonteId: q.fonteId,
      texto,
      materiaDb: q.materia,
      triHeur,
      triFinal: triHeur,
      conhecimentoEscopoId: q.conhecimentoEscopoId,
      classificacaoConfianca: q.classificacaoConfianca,
    };
  });

  let triagemIa = 0;

  if (retriagem) {
    if (modo === "ia") {
      const filaIa = itens.filter((q) => precisaTriagemIA(q.triHeur));

      for (let i = 0; i < filaIa.length; i += LOTE_TRIAGEM_IA) {
        const lote = filaIa.slice(i, i + LOTE_TRIAGEM_IA);
        const mapa = await triarLoteIA(
          lote.map((q) => ({ fonteId: q.fonteId, texto: q.texto }))
        );

        for (const q of lote) {
          const ia = mapa.get(q.fonteId);
          const antes = q.triHeur.materia;
          q.triFinal = mesclarTriagem(q.triHeur, ia);
          if (!antes && q.triFinal.materia) triagemIa++;
          else if (q.triHeur.motivo.startsWith("empate") && q.triFinal.materia) triagemIa++;
        }
      }
    }

    if (persistir) {
      for (const q of itens) {
        await prisma.enemQuestaoCorpus.update({
          where: { id: q.id },
          data: { materia: q.triFinal.materia },
        });
      }
    }
  } else {
    for (const q of itens) {
      q.triFinal = {
        materia:
          q.materiaDb === "Biologia" || q.materiaDb === "Química" || q.materiaDb === "Física"
            ? q.materiaDb
            : null,
        confianca: q.materiaDb ? 1 : 0,
        motivo: q.materiaDb ? "persistida" : "sem triagem",
      };
    }
  }

  const triagem = { biologia: 0, quimica: 0, fisica: 0, indefinida: 0 };
  const materiaParaClassificar: Array<{ id: string; fonteId: string; texto: string }> = [];

  for (const q of itens) {
    contarTriagem(triagem, q.triFinal.materia);

    const ehAlvo = q.triFinal.materia === materiaLabel;

    if (!opts.soTriagem && ehAlvo) {
      const jaTemN2 =
        q.conhecimentoEscopoId?.startsWith(`${prefixoN2}.`) === true &&
        (q.classificacaoConfianca ?? 0) >= confiancaMinima;
      if (!jaTemN2) {
        materiaParaClassificar.push({ id: q.id, fonteId: q.fonteId, texto: q.texto });
      }
    } else if (persistir && retriagem && !opts.soTriagem && q.triFinal.materia !== materiaLabel) {
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
  const versaoClass = modo === "ia" ? "ia-v1" : "heuristica-v1";

  if (!opts.soTriagem && materiaParaClassificar.length > 0) {
    if (modo === "ia") {
      for (let i = 0; i < materiaParaClassificar.length; i += LOTE_IA) {
        const lote = materiaParaClassificar.slice(i, i + LOTE_IA);
        const mapa = await classificarLoteIA(
          lote.map((q) => ({ fonteId: q.fonteId, texto: q.texto })),
          escopos,
          { materiaId, materiaLabel: catalog.materiaLabel }
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
          if (persistir) {
            await persistirResultado(prisma, q.id, resultado, versaoClass, materiaLabel);
          }
        }
      }
    } else {
      for (const q of materiaParaClassificar) {
        const resultado = classificarPorKeywords(q.texto, escopos, {
          confiancaMinima,
          assuntoId: opts.assuntoId,
        });
        resultados.push({ fonteId: q.fonteId, resultado });
        if (persistir) {
          await persistirResultado(prisma, q.id, resultado, versaoClass, materiaLabel);
        }
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
      materiaParaClassificar.length > 0
        ? Math.round((bench.classified / materiaParaClassificar.length) * 100)
        : triagem[materiaId === "biologia" ? "biologia" : materiaId === "quimica" ? "quimica" : "fisica"] > 0
          ? 100
          : 0,
    topEscopos: bench.topEscopos,
    triagem,
    triagemIa,
    materiaProcessadas: materiaParaClassificar.length,
    materiaId,
    modo,
  };
}
