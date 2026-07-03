import "server-only";

import { prisma } from "@/lib/prisma";
import {
  faixaIdiomaProva,
  inferirFaixaEnEsConfiavel,
  inferirFaixaPorVariantesEnEs,
  numeroNaFaixaIdioma,
  provaTemDuplicataEnEsReal,
  type FaixaIdiomaOpcional,
  type MetaPoliticaIdiomas,
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

async function normalizarVariantesOrfasParaComum(
  questoes: QuestaoSync[],
  faixaConfirmada: FaixaIdiomaOpcional | null
): Promise<number> {
  let reparadas = 0;
  for (const q of questoes) {
    const v = q.idiomaVariante ?? "COMUM";
    if (v !== "INGLES" && v !== "ESPANHOL") continue;

    const par = questoes.find(
      (o) =>
        o.id !== q.id &&
        o.numero === q.numero &&
        o.idiomaVariante !== v &&
        (o.idiomaVariante === "INGLES" || o.idiomaVariante === "ESPANHOL")
    );

    if (
      faixaConfirmada &&
      par &&
      numeroNaFaixaIdioma(q.numero, faixaConfirmada) &&
      numeroNaFaixaIdioma(par.numero, faixaConfirmada)
    ) {
      continue;
    }

    await prisma.provaQuestao.update({
      where: { id: q.id },
      data: { idiomaVariante: "COMUM" },
    });
    q.idiomaVariante = "COMUM";
    reparadas++;
  }
  return reparadas;
}

async function limparPoliticaDuplicata(provaId: string): Promise<void> {
  await prisma.prova.update({
    where: { id: provaId },
    data: {
      politicaIdiomas: "NENHUMA",
      idiomaQuestaoInicio: null,
      idiomaQuestaoFim: null,
    },
  });
}

function metaComFaixa(faixa: FaixaIdiomaOpcional): MetaPoliticaIdiomas {
  return {
    politicaIdiomas: "DUPLICATA_EN_ES",
    idiomaQuestaoInicio: faixa.inicio,
    idiomaQuestaoFim: faixa.fim,
  };
}

/**
 * Após importar/extrair questões: aplica DUPLICATA EN/ES só com evidência forte
 * (duplicata física ENEM 90+8 ou pares INGLES+ESPANHOL contíguos). Provas simples
 * (VUNESP/FAMERP) permanecem COMUM — interpretação em inglês no enunciado não conta.
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
  const cadastrada = faixaIdiomaProva(prova);
  const fisica = inferirFaixaEnEsConfiavel(questoes, prova.totalQuestoes);
  const porVariantes = inferirFaixaPorVariantesEnEs(questoes);

  const aplicarPolitica = async (
    faixa: FaixaIdiomaOpcional,
    opts?: { repararDuplicataFisica?: boolean }
  ): Promise<ResultadoSyncPosExtracao> => {
    const jaConfigurada =
      prova.politicaIdiomas === "DUPLICATA_EN_ES" &&
      prova.idiomaQuestaoInicio === faixa.inicio &&
      prova.idiomaQuestaoFim === faixa.fim;

    let variantesReparadas = 0;
    const metaFaixa = metaComFaixa(faixa);
    if (opts?.repararDuplicataFisica && !provaTemDuplicataEnEsReal(questoes, metaFaixa)) {
      variantesReparadas = await repararVariantesComumDuplicadas(questoes, faixa);
      if (variantesReparadas > 0) {
        avisos.push(
          `${variantesReparadas / 2} questão(ões) na faixa Q${faixa.inicio}–${faixa.fim} receberam trilha INGLES/ESPANHOL.`
        );
      }
    }

    if (!provaTemDuplicataEnEsReal(questoes, metaFaixa)) {
      variantesReparadas += await normalizarVariantesOrfasParaComum(questoes, null);
      if (prova.politicaIdiomas === "DUPLICATA_EN_ES") {
        await limparPoliticaDuplicata(provaId);
        avisos.push("Política EN/ES removida — duplicata não confirmada após extração.");
      }
      return { faixa: null, politicaAplicada: false, variantesReparadas, avisos };
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
  };

  if (fisica) {
    return aplicarPolitica(fisica, { repararDuplicataFisica: true });
  }

  if (porVariantes && provaTemDuplicataEnEsReal(questoes, metaComFaixa(porVariantes))) {
    return aplicarPolitica(porVariantes);
  }

  if (cadastrada && provaTemDuplicataEnEsReal(questoes, prova)) {
    return {
      faixa: cadastrada,
      politicaAplicada: false,
      variantesReparadas: 0,
      avisos,
    };
  }

  let variantesReparadas = 0;
  if (prova.politicaIdiomas === "DUPLICATA_EN_ES") {
    await limparPoliticaDuplicata(provaId);
    avisos.push(
      "Política EN/ES removida — esta prova não tem duplicata inglês+espanhol confirmada (mesmo número, duas trilhas)."
    );
  }
  variantesReparadas = await normalizarVariantesOrfasParaComum(questoes, null);
  if (variantesReparadas > 0) {
    avisos.push(
      `${variantesReparadas} linha(s) INGLES/ESPANHOL órfã(s) consolidadas como COMUM.`
    );
  }

  return { faixa: null, politicaAplicada: false, variantesReparadas, avisos };
}
