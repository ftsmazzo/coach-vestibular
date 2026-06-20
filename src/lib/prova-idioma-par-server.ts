import { prisma } from "@/lib/prisma";
import {
  faixaIdiomaProva,
  materiaParaVarianteIdioma,
  numeroNaFaixaIdioma,
  type MetaPoliticaIdiomas,
} from "@/lib/prova-idioma";

type ConteudoQuestaoIdioma = {
  areaBloco: string | null;
  materia: string;
  assunto: string;
  conhecimentoExigido: string | null;
  nivelDificuldade: string | null;
  observacoes: string | null;
  enunciado: string | null;
  gabarito: string | null;
};

function pickConteudo(q: {
  areaBloco: string | null;
  materia: string;
  assunto: string;
  conhecimentoExigido: string | null;
  nivelDificuldade: string | null;
  observacoes: string | null;
  enunciado: string | null;
  gabarito: string | null;
}): ConteudoQuestaoIdioma {
  return {
    areaBloco: q.areaBloco,
    materia: q.materia,
    assunto: q.assunto,
    conhecimentoExigido: q.conhecimentoExigido,
    nivelDificuldade: q.nivelDificuldade,
    observacoes: q.observacoes,
    enunciado: q.enunciado,
    gabarito: q.gabarito,
  };
}

/**
 * Troca classificação + gabarito entre as trilhas EN e ES do mesmo número.
 * Mantém idiomaVariante fixo em cada linha — só o conteúdo troca de lugar.
 */
export async function trocarConteudoParIdioma(
  provaId: string,
  numero: number
): Promise<boolean> {
  const [en, es] = await Promise.all([
    prisma.provaQuestao.findUnique({
      where: {
        provaId_numero_idiomaVariante: { provaId, numero, idiomaVariante: "INGLES" },
      },
    }),
    prisma.provaQuestao.findUnique({
      where: {
        provaId_numero_idiomaVariante: { provaId, numero, idiomaVariante: "ESPANHOL" },
      },
    }),
  ]);
  if (!en || !es) return false;

  const conteudoEn = pickConteudo(en);
  const conteudoEs = pickConteudo(es);

  await prisma.$transaction([
    prisma.provaQuestao.update({ where: { id: en.id }, data: conteudoEs }),
    prisma.provaQuestao.update({ where: { id: es.id }, data: conteudoEn }),
  ]);
  return true;
}

/**
 * Ao mudar matéria para Inglês/Espanhol na faixa duplicada, alinha conteúdo+gabarito
 * com a trilha correta (troca com a linha irmã se necessário).
 * Retorna o id da linha onde aplicar o PATCH (pode mudar após troca).
 */
export async function resolverQuestaoIdAposMateriaIdioma(
  prova: MetaPoliticaIdiomas,
  questaoId: string,
  provaId: string,
  novaMateria: string
): Promise<string> {
  const faixa = faixaIdiomaProva(prova);
  if (!faixa) return questaoId;

  const atual = await prisma.provaQuestao.findFirst({
    where: { id: questaoId, provaId },
  });
  if (!atual || !numeroNaFaixaIdioma(atual.numero, faixa)) return questaoId;

  const varianteAlvo = materiaParaVarianteIdioma(novaMateria);
  if (!varianteAlvo || varianteAlvo === atual.idiomaVariante) return questaoId;

  const irma = await prisma.provaQuestao.findUnique({
    where: {
      provaId_numero_idiomaVariante: {
        provaId,
        numero: atual.numero,
        idiomaVariante: varianteAlvo,
      },
    },
  });
  if (!irma) return questaoId;

  await trocarConteudoParIdioma(provaId, atual.numero);
  return irma.id;
}
