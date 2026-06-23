import type { PrismaClient } from "@/generated/prisma/client";
import {
  carregarCatalogoMateria,
  indexarEscopos,
} from "@/lib/conhecimento-catalog";
import { naFaixaL2Enem } from "@/lib/enem-classificar/linguagens-rota";
import { montarFonteId } from "@/lib/enem-dev/estrutural";

/** Versão do motor de classificação Linguagens (IA v12 unificado). */
export const LINGUAGENS_ROTA_VERSION = 7;

export type RepairLinguagensResultado = {
  corrigidas: number;
  n2Limpos: number;
  ignoradas: number;
  amostra: string[];
};

function escopoCompativelIdioma(assuntoId: string, idioma: string): boolean {
  if (idioma === "ingles") return assuntoId.startsWith("l2_en");
  if (idioma === "espanhol") return assuntoId.startsWith("l2_es");
  return assuntoId.startsWith("pt_");
}

/**
 * Reparo do corpus ENEM (camada import) — não é roteamento de classificação.
 * Garante idioma L2 só na faixa Q1–5 da API enem.dev.
 */
export async function repararIdiomaLinguagensCorpus(
  prisma: PrismaClient,
  opts: { dryRun?: boolean } = {}
): Promise<RepairLinguagensResultado> {
  const dryRun = opts.dryRun ?? false;
  const escopos = indexarEscopos(carregarCatalogoMateria("linguagens"));

  const rows = await prisma.enemQuestaoCorpus.findMany({
    where: { disciplina: "linguagens" },
    select: {
      id: true,
      ano: true,
      numero: true,
      idioma: true,
      fonteId: true,
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
    const assuntoId = r.conhecimentoEscopoId
      ? escopos.get(r.conhecimentoEscopoId)?.assuntoId
      : null;

    const limparN2 =
      Boolean(r.conhecimentoEscopoId && assuntoId) &&
      !escopoCompativelIdioma(assuntoId!, idiomaNovo);

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
      if (conflito && conflito.id !== r.id) conflitoFonteId = true;
    }

    if (amostra.length < 10) {
      amostra.push(
        `${r.fonteId} → ${fonteIdNovo} (${r.idioma}→${idiomaNovo}, Q${r.numero})` +
          (limparN2 ? " · N2 limpo" : "")
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

      if (conflitoFonteId && !limparN2) {
        ignoradas++;
        continue;
      }

      await prisma.enemQuestaoCorpus.update({
        where: { id: r.id },
        data: {
          ...(mudouIdioma ? { idioma: idiomaNovo } : {}),
          ...(mudouFonteId && !conflitoFonteId ? { fonteId: fonteIdNovo } : {}),
          ...dataN2,
        },
      });
    }

    corrigidas++;
    if (limparN2) n2Limpos++;
  }

  return { corrigidas, n2Limpos, ignoradas, amostra };
}
