import type { PrismaClient } from "@/generated/prisma/client";
import { inferirIdiomaCorpusLinguagens } from "@/lib/enem-classificar/linguagens-rota";
import { montarFonteId } from "@/lib/enem-dev/estrutural";

/** Bump quando mudar regra de roteamento L2 — admin exibe para confirmar deploy. */
export const LINGUAGENS_ROTA_VERSION = 2;

export type RepairLinguagensResultado = {
  corrigidas: number;
  n2Limpos: number;
  ignoradas: number;
  amostra: string[];
};

/** Corrige idioma/fonteId Q1–5 e limpa N2 de trilha errada. */
export async function repararIdiomaLinguagensCorpus(
  prisma: PrismaClient,
  opts: { dryRun?: boolean } = {}
): Promise<RepairLinguagensResultado> {
  const dryRun = opts.dryRun ?? false;
  const rows = await prisma.enemQuestaoCorpus.findMany({
    where: { disciplina: "linguagens", numero: { lte: 5 } },
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
    const texto = [r.enunciadoMd, r.introducaoAlternativas].filter(Boolean).join("\n");
    const idiomaDb = r.idioma === "ingles" || r.idioma === "espanhol" ? r.idioma : "COMUM";
    const idiomaNovo = inferirIdiomaCorpusLinguagens(
      r.numero,
      idiomaDb === "COMUM" ? null : idiomaDb,
      texto
    );
    const fonteIdNovo = montarFonteId(r.ano, r.numero, idiomaNovo);

    const limparN2 =
      r.conhecimentoEscopoId &&
      ((idiomaNovo === "ingles" && !r.conhecimentoEscopoId.includes("l2_en")) ||
        (idiomaNovo === "espanhol" && !r.conhecimentoEscopoId.includes("l2_es")) ||
        (idiomaNovo === "COMUM" &&
          (r.conhecimentoEscopoId.includes("l2_en") ||
            r.conhecimentoEscopoId.includes("l2_es"))));

    const precisaUpdate =
      idiomaNovo !== r.idioma || fonteIdNovo !== r.fonteId || Boolean(limparN2);

    if (!precisaUpdate) continue;

    if (fonteIdNovo !== r.fonteId) {
      const conflito = await prisma.enemQuestaoCorpus.findUnique({
        where: { fonteId: fonteIdNovo },
        select: { id: true },
      });
      if (conflito && conflito.id !== r.id) {
        ignoradas++;
        continue;
      }
    }

    if (amostra.length < 5) {
      amostra.push(
        `${r.fonteId} → ${fonteIdNovo} (${r.idioma}→${idiomaNovo})` +
          (limparN2 ? " · N2 limpo" : "")
      );
    }

    if (!dryRun) {
      await prisma.enemQuestaoCorpus.update({
        where: { id: r.id },
        data: {
          ...(idiomaNovo !== r.idioma ? { idioma: idiomaNovo } : {}),
          ...(fonteIdNovo !== r.fonteId ? { fonteId: fonteIdNovo } : {}),
          ...(limparN2
            ? {
                conhecimentoEscopoId: null,
                conhecimentoDominioId: null,
                assunto: null,
                classificacaoConfianca: null,
                classificacaoVersao: null,
              }
            : {}),
        },
      });
    }

    corrigidas++;
    if (limparN2) n2Limpos++;
  }

  return { corrigidas, n2Limpos, ignoradas, amostra };
}
