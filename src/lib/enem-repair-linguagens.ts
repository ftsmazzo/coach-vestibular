import type { PrismaClient } from "@/generated/prisma/client";
import {
  carregarCatalogoMateria,
  idFallbackNaoClassificado,
  indexarEscopos,
} from "@/lib/conhecimento-catalog";
import { naFaixaL2Enem } from "@/lib/enem-classificar/linguagens-rota";
import {
  routeLanguageDiscipline,
  validarEscopoNaRota,
} from "@/lib/enem-classificar/route-language-discipline";
import { montarFonteId } from "@/lib/enem-dev/estrutural";

/** Bump quando mudar regra de roteamento L2 — admin exibe para confirmar deploy. */
export const LINGUAGENS_ROTA_VERSION = 6;

export type RepairLinguagensResultado = {
  corrigidas: number;
  n2Limpos: number;
  ignoradas: number;
  amostra: string[];
};

/**
 * Reparo estrutural — reverte idioma L2 fora da faixa Q1–5 e limpa N2 fora da rota.
 * Sem heurística de texto; confia em enem.dev + posição ENEM.
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
      conhecimentoEscopoId: true,
    },
  });

  let corrigidas = 0;
  let n2Limpos = 0;
  let ignoradas = 0;
  const amostra: string[] = [];

  for (const r of rows) {
    let idiomaNovo: "COMUM" | "ingles" | "espanhol" =
      r.idioma === "ingles" || r.idioma === "espanhol" ? r.idioma : "COMUM";

    if (!naFaixaL2Enem(r.numero) && idiomaNovo !== "COMUM") {
      idiomaNovo = "COMUM";
    }

    const fonteIdNovo = montarFonteId(r.ano, r.numero, idiomaNovo);

    const rota = routeLanguageDiscipline(
      {
        idioma: idiomaNovo,
        numero: r.numero,
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

    if (amostra.length < 10) {
      amostra.push(
        `${r.fonteId} → ${fonteIdNovo} (${r.idioma}→${idiomaNovo}, Q${r.numero})` +
          (limparN2 ? " · N2 limpo" : "") +
          (conflitoFonteId ? " · conflito fonteId" : "")
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
          await prisma.enemQuestaoCorpus.update({ where: { id: r.id }, data: dataN2 });
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
