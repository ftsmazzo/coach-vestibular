import type { PrismaClient } from "@/generated/prisma/client";
import {
  carregarCatalogoMateria,
  catalogoUsaClassificadorV11,
  indexarEscopos,
  labelMateriaCorpus,
  prefixoCatalogoMateria,
  type MateriaCatalogo,
  type MateriaCorpusId,
} from "@/lib/conhecimento-catalog";
import {
  CLASSIFICADOR_CATALOGO_V11,
  classificarLoteCatalogoV11,
  type ClassificarV11Opts,
} from "@/lib/enem-classificar/classificar-catalogo-v11";
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
import {
  instrucaoIaLinguagens,
  type IdiomaTrilhaLinguagens,
} from "@/lib/enem-classificar/linguagens-rota";
import {
  routeLanguageDiscipline,
  filtrarEscoposPorRota,
  validarEscopoNaRota,
  versaoClassificacaoComRota,
  type DisciplinaLinguagens,
  type RotaLinguagens,
} from "@/lib/enem-classificar/route-language-discipline";
import { idFallbackNaoClassificado } from "@/lib/conhecimento-catalog/load";
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
const LOTE_IA_V11 = 4;
const LOTE_TRIAGEM_IA = 10;

type QuestaoParaClassificar = {
  id: string;
  fonteId: string;
  texto: string;
  gabarito?: string;
  enunciado?: string;
  alternativas?: string;
};

type AlternativaCorpus = { text?: string | null; letter?: string };

function montarTextoQuestaoCorpus(q: {
  enunciadoMd: string | null;
  introducaoAlternativas: string | null;
  alternativas?: unknown;
}): string {
  const { enunciado, alternativas } = montarPartesQuestaoCorpus(q);
  return [enunciado, alternativas].filter(Boolean).join("\n");
}

function montarPartesQuestaoCorpus(q: {
  enunciadoMd: string | null;
  introducaoAlternativas: string | null;
  alternativas?: unknown;
}): { enunciado: string; alternativas: string } {
  const enunciado = [q.enunciadoMd, q.introducaoAlternativas].filter(Boolean).join("\n");
  const altLinhas: string[] = [];

  if (Array.isArray(q.alternativas)) {
    for (const raw of q.alternativas) {
      const alt = raw as AlternativaCorpus;
      if (typeof alt.text === "string" && alt.text.trim()) {
        altLinhas.push(alt.letter ? `${alt.letter}) ${alt.text}` : alt.text);
      }
    }
  }

  return { enunciado, alternativas: altLinhas.join("\n") };
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
          conhecimentoExigido: resultado.conhecimentoExigido ?? undefined,
          classificacaoConfianca: resultado.confianca,
          classificacaoVersao: versao,
        }
      : {
          conhecimentoEscopoId: null,
          conhecimentoDominioId: null,
          conhecimentoExigido: resultado.conhecimentoExigido ?? undefined,
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
  materiaParaClassificar: QuestaoParaClassificar[],
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
    catalog?: MateriaCatalogo;
    instrucaoExtra?: string;
    v11Opts?: ClassificarV11Opts;
  }
): Promise<Array<{ fonteId: string; resultado: ResultadoClassificacao }>> {
  const resultados: Array<{ fonteId: string; resultado: ResultadoClassificacao }> = [];
  const usaV11 = Boolean(opts.catalog && catalogoUsaClassificadorV11(opts.catalog));
  const loteSize = usaV11 ? LOTE_IA_V11 : LOTE_IA;

  if (opts.modo === "ia") {
    for (let i = 0; i < materiaParaClassificar.length; i += loteSize) {
      const lote = materiaParaClassificar.slice(i, i + loteSize);

      const mapa =
        usaV11 && opts.catalog
          ? await classificarLoteCatalogoV11(
              lote.map((q) => ({
                fonteId: q.fonteId,
                enunciado: q.enunciado ?? q.texto,
                alternativas: q.alternativas ?? "",
                gabarito: q.gabarito,
              })),
              opts.catalog,
              opts.escopos,
              opts.v11Opts
            )
          : await classificarLoteIA(
              lote.map((q) => ({ fonteId: q.fonteId, texto: q.texto })),
              opts.escopos,
              {
                materiaId: opts.materiaId,
                materiaLabel: opts.catalogLabel,
                instrucaoExtra: opts.instrucaoExtra,
              }
            );
      for (const q of lote) {
        let resultado = mapa.get(q.fonteId)!;
        resultado.motivo = `${usaV11 ? "IA v11" : "IA"}: ${resultado.motivo}`;

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
  if (materiaId === "linguagens") {
    return classificarLinguagensTrilhas(prisma, opts);
  }

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
  const usaV11 = catalogoUsaClassificadorV11(catalog);
  const versaoClass =
    modo === "ia" ?
      usaV11 ? CLASSIFICADOR_CATALOGO_V11
      : "ia-v1"
    : "heuristica-v1";

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
      gabarito: true,
      conhecimentoEscopoId: true,
      classificacaoConfianca: true,
    },
    orderBy: [{ ano: "desc" }, { numero: "asc" }],
    take: limit,
  });

  const materiaParaClassificar: QuestaoParaClassificar[] = [];

  if (!opts.soTriagem) {
    for (const q of questoes) {
      const partes = montarPartesQuestaoCorpus(q);
      const texto = montarTextoQuestaoCorpus(q);
      const jaTemN2 =
        q.conhecimentoEscopoId?.startsWith(`${prefixoN2}.`) === true &&
        (q.classificacaoConfianca ?? 0) >= confiancaMinima;
      if (!jaTemN2) {
        materiaParaClassificar.push({
          id: q.id,
          fonteId: q.fonteId,
          texto,
          gabarito: q.gabarito,
          enunciado: partes.enunciado,
          alternativas: partes.alternativas,
        });
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
          catalog,
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

function n2ValidoRota(
  escopoId: string | null,
  confianca: number | null,
  rota: RotaLinguagens,
  escopos: ReturnType<typeof indexarEscopos>,
  confiancaMinima: number,
  prefixoN2: string
): boolean {
  if (!escopoId?.startsWith(`${prefixoN2}.`)) return false;
  if ((confianca ?? 0) < confiancaMinima) return false;
  return validarEscopoNaRota(
    { escopoId, assuntoId: escopos.get(escopoId)?.assuntoId ?? null },
    rota,
    escopos,
    idFallbackNaoClassificado("linguagens")
  );
}

function disciplinaParaTrilha(d: DisciplinaLinguagens): IdiomaTrilhaLinguagens {
  if (d === "ingles") return "ingles";
  if (d === "espanhol") return "espanhol";
  return "COMUM";
}

function aplicarRotaAoResultado(
  resultado: ResultadoClassificacao,
  rota: RotaLinguagens,
  escopos: ReturnType<typeof indexarEscopos>,
  fallbackId: string,
  confiancaMinima: number
): ResultadoClassificacao {
  const ok = validarEscopoNaRota(resultado, rota, escopos, fallbackId);
  const base = {
    ...resultado,
    disciplinaOriginalId: rota.disciplinaOriginalId,
    rotaCriterio: rota.criterio,
  };

  if (
    ok &&
    !rota.sinalizadorRevisao &&
    resultado.escopoId !== fallbackId &&
    (resultado.confianca ?? 0) >= confiancaMinima
  ) {
    return base;
  }

  if (!ok && resultado.escopoId && resultado.escopoId !== fallbackId) {
    return {
      ...base,
      status: "review",
      escopoId: fallbackId,
      assuntoId: null,
      dominioId: null,
      sinalizadorRevisao: true,
      motivo: `escopo fora da rota ${rota.disciplinaOriginalId}: ${resultado.motivo}`,
    };
  }

  if (rota.sinalizadorRevisao || rota.disciplinaOriginalId === "indefinido") {
    return {
      ...base,
      status: "review",
      sinalizadorRevisao: true,
    };
  }

  return base;
}

async function classificarLinguagensTrilhas(
  prisma: PrismaClient,
  opts: ClassificarCorpusOpts
): Promise<ClassificarCorpusResultado> {
  const materiaId = "linguagens" as const;
  const materiaLabel = labelMateriaCorpus(materiaId);
  const prefixoN2 = prefixoCatalogoMateria(materiaId);
  const catalog = carregarCatalogoMateria(materiaId);
  const escopos = indexarEscopos(catalog);
  const confiancaMinima = catalog.regras?.confiancaMinima ?? CLASSIFICACAO_CONFIANCA_MIN;
  const fallbackId = idFallbackNaoClassificado(materiaId);
  const limit = Math.min(opts.limit ?? LIMITE_MAX, LIMITE_MAX);
  const persistir = opts.persistir ?? true;
  const modo =
    opts.modo === "ia" && iaClassificacaoDisponivel() ? "ia" : "heuristica";
  const usaV11 = catalogoUsaClassificadorV11(catalog);
  const versaoBase =
    modo === "ia" ?
      usaV11 ? `${CLASSIFICADOR_CATALOGO_V11}-ling`
      : "ia-ling-v1"
    : "heuristica-ling-v1";

  const questoes = await prisma.enemQuestaoCorpus.findMany({
    where: {
      disciplina: "linguagens",
      ...(opts.ano ? { ano: opts.ano } : {}),
    },
    select: {
      id: true,
      fonteId: true,
      numero: true,
      idioma: true,
      enunciadoMd: true,
      introducaoAlternativas: true,
      alternativas: true,
      gabarito: true,
      conhecimentoEscopoId: true,
      classificacaoConfianca: true,
    },
    orderBy: [{ ano: "desc" }, { numero: "asc" }],
    take: limit,
  });

  type ItemRota = {
    id: string;
    fonteId: string;
    texto: string;
    enunciado: string;
    alternativas: string;
    gabarito: string;
    rota: RotaLinguagens;
  };

  const porDisciplina = new Map<DisciplinaLinguagens, ItemRota[]>();
  const indefinidos: ItemRota[] = [];
  for (const d of ["portugues", "ingles", "espanhol", "indefinido"] as const) {
    porDisciplina.set(d, []);
  }

  const contagemTrilha = { portugues: 0, ingles: 0, espanhol: 0, indefinido: 0 };

  if (!opts.soTriagem) {
    for (const q of questoes) {
      const texto = montarTextoQuestaoCorpus(q);
      const partes = montarPartesQuestaoCorpus(q);
      const enunciado = partes.enunciado;
      const alternativas = partes.alternativas;

      const rota = routeLanguageDiscipline(
        {
          idioma: q.idioma,
          numero: q.numero,
          enunciado,
          alternativas,
          textoBase: enunciado,
          origem: "enem_api",
        },
        catalog
      );

      if (rota.disciplinaOriginalId === "ingles") contagemTrilha.ingles++;
      else if (rota.disciplinaOriginalId === "espanhol") contagemTrilha.espanhol++;
      else if (rota.disciplinaOriginalId === "portugues") contagemTrilha.portugues++;
      else contagemTrilha.indefinido++;

      const jaTemN2 = n2ValidoRota(
        q.conhecimentoEscopoId,
        q.classificacaoConfianca,
        rota,
        escopos,
        confiancaMinima,
        prefixoN2
      );

      const item: ItemRota = {
        id: q.id,
        fonteId: q.fonteId,
        texto,
        enunciado,
        alternativas,
        gabarito: q.gabarito,
        rota,
      };

      if (!jaTemN2) {
        if (rota.disciplinaOriginalId === "indefinido") {
          indefinidos.push(item);
        } else {
          porDisciplina.get(rota.disciplinaOriginalId)!.push(item);
        }
      }
    }
  }

  const resultados: Array<{ fonteId: string; resultado: ResultadoClassificacao }> = [];

  for (const item of indefinidos) {
    const resultado: ResultadoClassificacao = {
      status: "review",
      confianca: 0,
      materiaId,
      assuntoId: null,
      dominioId: null,
      escopoId: fallbackId,
      conceitoCanonic: null,
      motivo: `rota incerta: ${item.rota.justificativa}`,
      disciplinaOriginalId: "indefinido",
      rotaCriterio: item.rota.criterio,
      sinalizadorRevisao: true,
    };
    resultados.push({ fonteId: item.fonteId, resultado });
    if (persistir) {
      await persistirResultado(
        prisma,
        item.id,
        resultado,
        versaoClassificacaoComRota(versaoBase, item.rota),
        materiaLabel
      );
    }
  }

  for (const [disciplina, itens] of porDisciplina) {
    if (disciplina === "indefinido" || itens.length === 0) continue;

    const rotaRef = itens[0]!.rota;
    const escoposRota = filtrarEscoposPorRota(escopos, rotaRef);
    const trilha = disciplinaParaTrilha(disciplina);

    const parcial = await classificarLoteQuestoes(
      prisma,
      itens.map((i) => ({
        id: i.id,
        fonteId: i.fonteId,
        texto: i.texto,
        enunciado: i.enunciado,
        alternativas: i.alternativas,
        gabarito: i.gabarito,
      })),
      {
        modo,
        escopos: escoposRota,
        confiancaMinima,
        assuntoId: opts.assuntoId,
        persistir: false,
        versaoClass: versaoClassificacaoComRota(versaoBase, rotaRef),
        materiaLabel,
        materiaId,
        catalogLabel: catalog.materiaLabel,
        catalog,
        instrucaoExtra: instrucaoIaLinguagens(trilha),
        v11Opts: { rotaDisciplina: disciplina, instrucaoExtra: rotaRef.justificativa },
      }
    );

    for (const row of parcial) {
      const item = itens.find((i) => i.fonteId === row.fonteId)!;
      const resultado = aplicarRotaAoResultado(
        row.resultado,
        item.rota,
        escopos,
        fallbackId,
        confiancaMinima
      );
      resultados.push({ fonteId: row.fonteId, resultado });
      if (persistir) {
        await persistirResultado(
          prisma,
          item.id,
          resultado,
          versaoClassificacaoComRota(versaoBase, item.rota),
          materiaLabel
        );
      }
    }
  }

  const bench = agregarBenchmark(resultados);
  const totalClassificar =
    indefinidos.length +
    [...porDisciplina.values()].reduce((s, a) => s + a.length, 0);

  return {
    processadas: questoes.length,
    classified: bench.classified,
    unclassified: bench.unclassified,
    review: bench.review,
    pctClassified:
      totalClassificar > 0
        ? Math.round((bench.classified / totalClassificar) * 100)
        : questoes.length > 0
          ? 100
          : 0,
    topEscopos: bench.topEscopos,
    triagem: {
      biologia: contagemTrilha.portugues,
      quimica: contagemTrilha.ingles,
      fisica: contagemTrilha.espanhol,
      indefinida: contagemTrilha.indefinido,
    },
    triagemIa: 0,
    materiaProcessadas: totalClassificar,
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
  const usaV11 = catalogoUsaClassificadorV11(catalog);
  const versaoClass =
    modo === "ia" ?
      usaV11 ? CLASSIFICADOR_CATALOGO_V11
      : "ia-v1"
    : "heuristica-v1";

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
      gabarito: true,
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
    gabarito: string;
    enunciado: string;
    alternativas: string;
    materiaDb: string | null;
    triHeur: TriagemNatureza;
    triFinal: TriagemNatureza;
    conhecimentoEscopoId: string | null;
    classificacaoConfianca: number | null;
  };

  const itens: Item[] = questoes.map((q) => {
    const partes = montarPartesQuestaoCorpus(q);
    const texto = montarTextoQuestaoCorpus(q);
    const triHeur = triarMateriaNatureza(texto);
    return {
      id: q.id,
      fonteId: q.fonteId,
      texto,
      gabarito: q.gabarito,
      enunciado: partes.enunciado,
      alternativas: partes.alternativas,
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
  const materiaParaClassificar: QuestaoParaClassificar[] = [];

  for (const q of itens) {
    contarTriagem(triagem, q.triFinal.materia);

    const ehAlvo = q.triFinal.materia === materiaLabel;

    if (!opts.soTriagem && ehAlvo) {
      const jaTemN2 =
        q.conhecimentoEscopoId?.startsWith(`${prefixoN2}.`) === true &&
        (q.classificacaoConfianca ?? 0) >= confiancaMinima;
      if (!jaTemN2) {
        materiaParaClassificar.push({
          id: q.id,
          fonteId: q.fonteId,
          texto: q.texto,
          gabarito: q.gabarito,
          enunciado: q.enunciado,
          alternativas: q.alternativas,
        });
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
          catalog,
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
