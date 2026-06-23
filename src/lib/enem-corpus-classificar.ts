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
import { CORPUS_MATERIA_CONFIG } from "@/lib/enem-corpus-materia";
import { CLASSIFICACAO_CONFIANCA_MIN } from "@/lib/enem-corpus-stats";
import type { ResultadoClassificacao } from "@/lib/conhecimento-catalog/types";

export type ClassificarCorpusOpts = {
  materiaId?: MateriaCorpusId;
  assuntoId?: string;
  ano?: number;
  limit?: number;
  persistir?: boolean;
  soTriagem?: boolean;
  /** Reexecuta triagem Bio/Quím/Fís (só Natureza) */
  retriagem?: boolean;
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

const LIMITE_MAX = 900;
const LOTE_IA = 8;
const LOTE_TRIAGEM_IA = 10;

type AlternativaCorpus = { text?: string | null; letter?: string };

function montarTextoQuestaoCorpus(q: {
  enunciadoMd: string | null;
  introducaoAlternativas: string | null;
  alternativas?: unknown;
}): string {
  const partes = [q.enunciadoMd, q.introducaoAlternativas].filter(Boolean) as string[];

  if (Array.isArray(q.alternativas)) {
    for (const raw of q.alternativas) {
      const alt = raw as AlternativaCorpus;
      if (typeof alt.text === "string" && alt.text.trim()) {
        partes.push(alt.letter ? `${alt.letter}) ${alt.text}` : alt.text);
      }
    }
  }

  return partes.join("\n");
}

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

async function classificarLoteQuestoes(
  prisma: PrismaClient,
  materiaParaClassificar: Array<{ id: string; fonteId: string; texto: string }>,
  opts: {
    modo: "heuristica" | "ia";
    escopos: ReturnType<typeof indexarEscopos>;
    confiancaMinima: number;
    assuntoId?: string;
    persistir: boolean;
    versaoClass: string;
    materiaLabel: string;
    materiaId: MateriaCorpusId;
    catalogLabel: string;
  }
): Promise<Array<{ fonteId: string; resultado: ResultadoClassificacao }>> {
  const resultados: Array<{ fonteId: string; resultado: ResultadoClassificacao }> = [];

  if (opts.modo === "ia") {
    for (let i = 0; i < materiaParaClassificar.length; i += LOTE_IA) {
      const lote = materiaParaClassificar.slice(i, i + LOTE_IA);
      const mapa = await classificarLoteIA(
        lote.map((q) => ({ fonteId: q.fonteId, texto: q.texto })),
        opts.escopos,
        { materiaId: opts.materiaId, materiaLabel: opts.catalogLabel }
      );
      for (const q of lote) {
        let resultado = mapa.get(q.fonteId)!;
        resultado.motivo = `IA: ${resultado.motivo}`;

        if (resultado.status === "unclassified") {
          const fallback = classificarPorKeywords(q.texto, opts.escopos, {
            confiancaMinima: opts.confiancaMinima,
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
        if (opts.persistir) {
          await persistirResultado(prisma, q.id, resultado, opts.versaoClass, opts.materiaLabel);
        }
      }
    }
  } else {
    for (const q of materiaParaClassificar) {
      const resultado = classificarPorKeywords(q.texto, opts.escopos, {
        confiancaMinima: opts.confiancaMinima,
        assuntoId: opts.assuntoId,
      });
      resultados.push({ fonteId: q.fonteId, resultado });
      if (opts.persistir) {
        await persistirResultado(prisma, q.id, resultado, opts.versaoClass, opts.materiaLabel);
      }
    }
  }

  return resultados;
}

async function classificarDisciplinaUnica(
  prisma: PrismaClient,
  opts: ClassificarCorpusOpts,
  materiaId: MateriaCorpusId
): Promise<ClassificarCorpusResultado> {
  const cfg = CORPUS_MATERIA_CONFIG[materiaId];
  const materiaLabel = labelMateriaCorpus(materiaId);
  const prefixoN2 = prefixoCatalogoMateria(materiaId);
  const catalog = carregarCatalogoMateria(materiaId);
  const escopos = indexarEscopos(catalog);
  const confiancaMinima = catalog.regras?.confiancaMinima ?? CLASSIFICACAO_CONFIANCA_MIN;
  const limit = Math.min(opts.limit ?? LIMITE_MAX, LIMITE_MAX);
  const persistir = opts.persistir ?? true;
  const modo =
    opts.modo === "ia" && iaClassificacaoDisponivel() ? "ia" : "heuristica";
  const versaoClass = modo === "ia" ? "ia-v1" : "heuristica-v1";

  const questoes = await prisma.enemQuestaoCorpus.findMany({
    where: {
      disciplina: cfg.disciplina,
      ...(opts.ano ? { ano: opts.ano } : {}),
    },
    select: {
      id: true,
      fonteId: true,
      enunciadoMd: true,
      introducaoAlternativas: true,
      alternativas: true,
      conhecimentoEscopoId: true,
      classificacaoConfianca: true,
    },
    orderBy: [{ ano: "desc" }, { numero: "asc" }],
    take: limit,
  });

  const materiaParaClassificar: Array<{ id: string; fonteId: string; texto: string }> = [];

  if (!opts.soTriagem) {
    for (const q of questoes) {
      const texto = montarTextoQuestaoCorpus(q);
      const jaTemN2 =
        q.conhecimentoEscopoId?.startsWith(`${prefixoN2}.`) === true &&
        (q.classificacaoConfianca ?? 0) >= confiancaMinima;
      if (!jaTemN2) {
        materiaParaClassificar.push({ id: q.id, fonteId: q.fonteId, texto });
      }
    }
  }

  const resultados =
    materiaParaClassificar.length > 0
      ? await classificarLoteQuestoes(prisma, materiaParaClassificar, {
          modo,
          escopos,
          confiancaMinima,
          assuntoId: opts.assuntoId,
          persistir,
          versaoClass,
          materiaLabel,
          materiaId,
          catalogLabel: catalog.materiaLabel,
        })
      : [];

  const bench = agregarBenchmark(resultados);
  return {
    processadas: questoes.length,
    classified: bench.classified,
    unclassified: bench.unclassified,
    review: bench.review,
    pctClassified:
      materiaParaClassificar.length > 0
        ? Math.round((bench.classified / materiaParaClassificar.length) * 100)
        : questoes.length > 0
          ? 100
          : 0,
    topEscopos: bench.topEscopos,
    triagem: { biologia: 0, quimica: 0, fisica: 0, indefinida: 0 },
    triagemIa: 0,
    materiaProcessadas: materiaParaClassificar.length,
    materiaId,
    modo,
  };
}

async function classificarNaturezaSub(
  prisma: PrismaClient,
  opts: ClassificarCorpusOpts,
  materiaId: MateriaCorpusId
): Promise<ClassificarCorpusResultado> {
  const materiaLabel = labelMateriaCorpus(materiaId);
  const prefixoN2 = prefixoCatalogoMateria(materiaId);
  const catalog = carregarCatalogoMateria(materiaId);
  const escopos = indexarEscopos(catalog);
  const confiancaMinima = catalog.regras?.confiancaMinima ?? CLASSIFICACAO_CONFIANCA_MIN;
  const limit = Math.min(opts.limit ?? LIMITE_MAX, LIMITE_MAX);
  const persistir = opts.persistir ?? true;
  const retriagem = opts.retriagem ?? false;
  const modo =
    opts.modo === "ia" && iaClassificacaoDisponivel() ? "ia" : "heuristica";
  const versaoClass = modo === "ia" ? "ia-v1" : "heuristica-v1";

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
      alternativas: true,
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
    const texto = montarTextoQuestaoCorpus(q);
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

  const resultados =
    !opts.soTriagem && materiaParaClassificar.length > 0
      ? await classificarLoteQuestoes(prisma, materiaParaClassificar, {
          modo,
          escopos,
          confiancaMinima,
          assuntoId: opts.assuntoId,
          persistir,
          versaoClass,
          materiaLabel,
          materiaId,
          catalogLabel: catalog.materiaLabel,
        })
      : [];

  const bench = agregarBenchmark(resultados);
  const triKey =
    materiaId === "biologia" ? "biologia" : materiaId === "quimica" ? "quimica" : "fisica";

  return {
    processadas: questoes.length,
    classified: bench.classified,
    unclassified: bench.unclassified,
    review: bench.review,
    pctClassified:
      materiaParaClassificar.length > 0
        ? Math.round((bench.classified / materiaParaClassificar.length) * 100)
        : triagem[triKey] > 0
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

export async function classificarCorpusEnem(
  prisma: PrismaClient,
  opts: ClassificarCorpusOpts = {}
): Promise<ClassificarCorpusResultado> {
  const materiaId = opts.materiaId ?? "biologia";
  const cfg = CORPUS_MATERIA_CONFIG[materiaId];

  if (cfg.naturezaSub) {
    return classificarNaturezaSub(prisma, opts, materiaId);
  }
  return classificarDisciplinaUnica(prisma, opts, materiaId);
}
