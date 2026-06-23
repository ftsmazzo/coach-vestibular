import type { PrismaClient } from "@/generated/prisma/client";
import {
  carregarCatalogoMateria,
  idFallbackNaoClassificado,
  indexarEscopos,
} from "@/lib/conhecimento-catalog";
import { inferirIdiomaCorpusLinguagens } from "@/lib/enem-classificar/linguagens-rota";
import {
  routeLanguageDiscipline,
  validarEscopoNaRota,
} from "@/lib/enem-classificar/route-language-discipline";
import { montarFonteId } from "@/lib/enem-dev/estrutural";

/** Bump quando mudar regra de roteamento L2 — admin exibe para confirmar deploy. */
export const LINGUAGENS_ROTA_VERSION = 4;

export type RepairLinguagensResultado = {
  corrigidas: number;
  n2Limpos: number;
  ignoradas: number;
  amostra: string[];
};

type AlternativaCorpus = { text?: string | null; letter?: string };

function montarPartesRepair(row: {
  enunciadoMd: string | null;
  introducaoAlternativas: string | null;
  alternativas?: unknown;
}): { enunciado: string; alternativas: string } {
  const enunciado = [row.enunciadoMd, row.introducaoAlternativas].filter(Boolean).join("\n");
  const altLinhas: string[] = [];
  if (Array.isArray(row.alternativas)) {
    for (const raw of row.alternativas) {
      const alt = raw as AlternativaCorpus;
      if (typeof alt.text === "string" && alt.text.trim()) {
        altLinhas.push(alt.letter ? `${alt.letter}) ${alt.text}` : alt.text);
      }
    }
  }
  return { enunciado, alternativas: altLinhas.join("\n") };
}

/**
 * Corrige idioma/fonteId e limpa N2 fora da rota em Linguagens.
 * Inclui COMUM Q6+ com texto EN/ES (corpus enem.dev pode marcar errado).
 */
export async function repararIdiomaLinguagensCorpus(
  prisma: PrismaClient,
  opts: { dryRun?: boolean } = {}
): Promise<RepairLinguagensResultado> {
  const dryRun = opts.dryRun ?? false;
  const catalog = carregarCatalogoMateria("linguagens");
  const escopos = indexarEscopos(catalog);
  const fallbackId = idFallbackNaoClassificado("linguagens");

  const rows = await prisma.enemQuestaoCorpus.findMany({
    where: { disciplina: "linguagens" },
    select: {
      id: true,
      ano: true,
      numero: true,
      idioma: true,
      fonteId: true,
      enunciadoMd: true,
      introducaoAlternativas: true,
      alternativas: true,
      conhecimentoEscopoId: true,
    },
  });

  let corrigidas = 0;
  let n2Limpos = 0;
  let ignoradas = 0;
  const amostra: string[] = [];

  for (const r of rows) {
    const { enunciado, alternativas } = montarPartesRepair(r);
    const texto = [enunciado, alternativas].filter(Boolean).join("\n");
    const idiomaDb =
      r.idioma === "ingles" || r.idioma === "espanhol" ? r.idioma : "COMUM";
    const idiomaNovo = inferirIdiomaCorpusLinguagens(
      r.numero,
      idiomaDb === "COMUM" ? null : idiomaDb,
      texto
    );
    const fonteIdNovo = montarFonteId(r.ano, r.numero, idiomaNovo);

    const rota = routeLanguageDiscipline(
      {
        idioma: idiomaNovo,
        numero: r.numero,
        enunciado,
        alternativas,
        textoBase: enunciado,
        origem: "enem_api",
      },
      catalog
    );

    const limparN2 =
      Boolean(r.conhecimentoEscopoId) &&
      !validarEscopoNaRota(
        {
          escopoId: r.conhecimentoEscopoId,
          assuntoId: escopos.get(r.conhecimentoEscopoId!)?.assuntoId ?? null,
        },
        rota,
        escopos,
        fallbackId
      );

    const mudouIdioma = idiomaNovo !== r.idioma;
    const mudouFonteId = fonteIdNovo !== r.fonteId;
    const precisaUpdate = mudouIdioma || mudouFonteId || limparN2;

    if (!precisaUpdate) continue;

    let conflitoFonteId = false;
    if (mudouFonteId) {
      const conflito = await prisma.enemQuestaoCorpus.findUnique({
        where: { fonteId: fonteIdNovo },
        select: { id: true },
      });
      if (conflito && conflito.id !== r.id) {
        conflitoFonteId = true;
      }
    }

    if (amostra.length < 8) {
      amostra.push(
        `${r.fonteId} → ${fonteIdNovo} (${r.idioma}→${idiomaNovo}, rota=${rota.disciplinaOriginalId})` +
          (limparN2 ? " · N2 limpo" : "") +
          (conflitoFonteId ? " · fonteId conflito" : "")
      );
    }

    if (!dryRun) {
      const dataN2 = limparN2
        ? {
            conhecimentoEscopoId: null,
            conhecimentoDominioId: null,
            assunto: null,
            classificacaoConfianca: null,
            classificacaoVersao: null,
          }
        : {};

      if (conflitoFonteId) {
        if (limparN2) {
          await prisma.enemQuestaoCorpus.update({
            where: { id: r.id },
            data: dataN2,
          });
        } else {
          ignoradas++;
          continue;
        }
      } else {
        await prisma.enemQuestaoCorpus.update({
          where: { id: r.id },
          data: {
            ...(mudouIdioma ? { idioma: idiomaNovo } : {}),
            ...(mudouFonteId ? { fonteId: fonteIdNovo } : {}),
            ...dataN2,
          },
        });
      }
    }

    corrigidas++;
    if (limparN2) n2Limpos++;
    if (conflitoFonteId && !limparN2) ignoradas++;
  }

  return { corrigidas, n2Limpos, ignoradas, amostra };
}
