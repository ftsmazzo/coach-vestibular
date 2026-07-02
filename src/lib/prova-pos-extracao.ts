import "server-only";

import { prisma } from "@/lib/prisma";
import {
  inferirFaixaPorNumerosDuplicados,
  questoesTemVariantesEnEs,
  resolverFaixaIdiomaDualDeQuestoes,
  type FaixaIdiomaOpcional,
} from "@/lib/prova-idioma";

export type ResultadoSyncPosExtracao = {
  faixa: FaixaIdiomaOpcional | null;
  politicaAplicada: boolean;
  variantesReparadas: number;
  avisos: string[];
};

type QuestaoSync = {
  id: string;
  ordemExtracao: number;
  numero: number;
  idiomaVariante: string;
};

async function repararVariantesComumDuplicadas(
  questoes: QuestaoSync[],
  faixa: FaixaIdiomaOpcional
): Promise<number> {
  let reparadas = 0;
  for (let n = faixa.inicio; n <= faixa.fim; n++) {
    const linhas = questoes
      .filter((q) => q.numero === n && (q.idiomaVariante ?? "COMUM") === "COMUM")
      .sort((a, b) => a.ordemExtracao - b.ordemExtracao);
    if (linhas.length !== 2) continue;

    await prisma.provaQuestao.update({
      where: { id: linhas[0].id },
      data: { idiomaVariante: "INGLES" },
    });
    await prisma.provaQuestao.update({
      where: { id: linhas[1].id },
      data: { idiomaVariante: "ESPANHOL" },
    });
    linhas[0].idiomaVariante = "INGLES";
    linhas[1].idiomaVariante = "ESPANHOL";
    reparadas += 2;
  }
  return reparadas;
}

/**
 * Após importar/extrair questões: detecta faixa EN/ES, repara variantes COMUM duplicadas
 * e grava política DUPLICATA_EN_ES na prova (idempotente).
 */
export async function sincronizarMetadadosPosExtracao(
  provaId: string
): Promise<ResultadoSyncPosExtracao> {
  const avisos: string[] = [];

  const prova = await prisma.prova.findUnique({
    where: { id: provaId },
    include: {
      questoes: {
        orderBy: { ordemExtracao: "asc" },
        select: { id: true, ordemExtracao: true, numero: true, idiomaVariante: true },
      },
    },
  });

  if (!prova || prova.questoes.length === 0) {
    return { faixa: null, politicaAplicada: false, variantesReparadas: 0, avisos };
  }

  let questoes = prova.questoes as QuestaoSync[];

  let faixa = resolverFaixaIdiomaDualDeQuestoes(questoes, prova);

  if (!faixa && prova.totalQuestoes >= 16) {
    const dup = inferirFaixaPorNumerosDuplicados(questoes);
    if (dup) faixa = dup;
  }

  if (!faixa) {
    return { faixa: null, politicaAplicada: false, variantesReparadas: 0, avisos };
  }

  let variantesReparadas = 0;
  if (!questoesTemVariantesEnEs(questoes)) {
    variantesReparadas = await repararVariantesComumDuplicadas(questoes, faixa);
    if (variantesReparadas > 0) {
      avisos.push(
        `${variantesReparadas / 2} questão(ões) na faixa Q${faixa.inicio}–${faixa.fim} receberam trilha INGLES/ESPANHOL.`
      );
    }
  }

  const jaConfigurada =
    prova.politicaIdiomas === "DUPLICATA_EN_ES" &&
    prova.idiomaQuestaoInicio === faixa.inicio &&
    prova.idiomaQuestaoFim === faixa.fim;

  if (!jaConfigurada) {
    await prisma.prova.update({
      where: { id: provaId },
      data: {
        politicaIdiomas: "DUPLICATA_EN_ES",
        idiomaQuestaoInicio: faixa.inicio,
        idiomaQuestaoFim: faixa.fim,
      },
    });
    avisos.push(
      `Faixa de idiomas Q${faixa.inicio}–${faixa.fim} configurada para gabarito dual EN/ES.`
    );
  }

  return {
    faixa,
    politicaAplicada: !jaConfigurada || variantesReparadas > 0,
    variantesReparadas,
    avisos,
  };
}
