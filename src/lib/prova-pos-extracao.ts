import "server-only";

import { prisma } from "@/lib/prisma";
import {
  faixaIdiomaProva,
  inferirFaixaEnEsConfiavel,
  inferirFaixaPorVariantesEnEs,
  questoesTemVariantesEnEs,
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

function resolverFaixaParaSync(
  questoes: QuestaoSync[],
  prova: {
    politicaIdiomas?: string | null;
    idiomaQuestaoInicio?: number | null;
    idiomaQuestaoFim?: number | null;
    totalQuestoes: number;
  }
): FaixaIdiomaOpcional | null {
  const cadastrada = faixaIdiomaProva(prova);
  if (cadastrada) return cadastrada;
  if (questoesTemVariantesEnEs(questoes)) {
    return inferirFaixaPorVariantesEnEs(questoes);
  }
  return inferirFaixaEnEsConfiavel(questoes, prova.totalQuestoes);
}

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
 * Após importar/extrair questões: detecta faixa EN/ES (só com evidência forte),
 * repara variantes COMUM duplicadas e grava política DUPLICATA_EN_ES (idempotente).
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

  const questoes = prova.questoes as QuestaoSync[];
  const faixa = resolverFaixaParaSync(questoes, prova);

  if (!faixa) {
    return { faixa: null, politicaAplicada: false, variantesReparadas: 0, avisos };
  }

  const jaConfigurada =
    prova.politicaIdiomas === "DUPLICATA_EN_ES" &&
    prova.idiomaQuestaoInicio === faixa.inicio &&
    prova.idiomaQuestaoFim === faixa.fim;

  let variantesReparadas = 0;
  if (!questoesTemVariantesEnEs(questoes)) {
    variantesReparadas = await repararVariantesComumDuplicadas(questoes, faixa);
    if (variantesReparadas > 0) {
      avisos.push(
        `${variantesReparadas / 2} questão(ões) na faixa Q${faixa.inicio}–${faixa.fim} receberam trilha INGLES/ESPANHOL.`
      );
    }
  }

  const podeAplicarPolitica =
    jaConfigurada ||
    questoesTemVariantesEnEs(questoes) ||
    variantesReparadas > 0 ||
    faixaIdiomaProva(prova) != null;

  if (!podeAplicarPolitica) {
    avisos.push(
      `Duplicatas em Q${faixa.inicio}–${faixa.fim} não confirmadas — configure a faixa EN/ES manualmente na aba Prova.`
    );
    return { faixa, politicaAplicada: false, variantesReparadas, avisos };
  }

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
