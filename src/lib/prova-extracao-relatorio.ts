import type { IdiomaVarianteQuestao } from "@/generated/prisma/client";
import {
  ENUNCIADO_VALIDACAO_MIN_CHARS,
  sanitizarTextoProva,
  statusEnunciadoExtracao,
  type StatusExtracaoQuestao,
} from "@/lib/prova-texto-prova";
import {
  chaveQuestaoVariante,
  compararQuestoesPorNumeroEOrdem,
  variantesExigidasPorNumero,
  type MetaPoliticaIdiomas,
} from "@/lib/prova-idioma";
import { resolverNumerosGradeProva } from "@/lib/prova-numeracao";

export type LinhaExtracaoRelatorio = {
  chave: string;
  numero: number;
  idiomaVariante: IdiomaVarianteQuestao;
  questaoId?: string;
  areaBloco?: string | null;
  enunciado?: string | null;
  alternativas?: string | null;
  tamanhoEnunciado: number;
  tamanhoAlternativas: number;
  status: StatusExtracaoQuestao;
};

export type RelatorioExtracaoProva = {
  totalEsperado: number;
  linhasEsperadas: number;
  linhasNoBanco: number;
  ok: number;
  curto: number;
  faltando: number;
  prontaParaValidar: boolean;
  linhas: LinhaExtracaoRelatorio[];
};

type QuestaoDb = {
  id: string;
  numero: number;
  idiomaVariante: IdiomaVarianteQuestao | string;
  areaBloco?: string | null;
  enunciado?: string | null;
  alternativas?: string | null;
};

export function montarRelatorioExtracao(
  questoes: QuestaoDb[],
  totalEsperado: number,
  meta: MetaPoliticaIdiomas & { dia?: number | null; banca?: string; ordemIdiomasFaixa?: string | null }
): RelatorioExtracaoProva {
  const porChave = new Map<string, QuestaoDb>();
  for (const q of questoes) {
    porChave.set(
      chaveQuestaoVariante(q.numero, (q.idiomaVariante as IdiomaVarianteQuestao) ?? "COMUM"),
      q
    );
  }

  const numeros = resolverNumerosGradeProva({
    totalQuestoes: totalEsperado,
    dia: meta.dia,
    banca: meta.banca,
    numerosCadastrados: questoes.map((q) => q.numero),
  });

  const slots: Array<{ numero: number; idiomaVariante: IdiomaVarianteQuestao }> = [];
  for (const n of numeros) {
    for (const v of variantesExigidasPorNumero(n, meta)) {
      slots.push({ numero: n, idiomaVariante: v });
    }
  }

  const linhas: LinhaExtracaoRelatorio[] = slots.map(({ numero, idiomaVariante }) => {
    const chave = chaveQuestaoVariante(numero, idiomaVariante);
    const q = porChave.get(chave);
    const en = sanitizarTextoProva(q?.enunciado);
    const alt = sanitizarTextoProva(q?.alternativas);
    const status = q ? statusEnunciadoExtracao(en) : "faltando";
    return {
      chave,
      numero,
      idiomaVariante,
      questaoId: q?.id,
      areaBloco: q?.areaBloco ?? null,
      enunciado: en || null,
      alternativas: alt || null,
      tamanhoEnunciado: en.length,
      tamanhoAlternativas: alt.length,
      status,
    };
  });

  linhas.sort((a, b) =>
    compararQuestoesPorNumeroEOrdem(
      { numero: a.numero, idiomaVariante: a.idiomaVariante },
      { numero: b.numero, idiomaVariante: b.idiomaVariante },
      meta.ordemIdiomasFaixa ?? "INGLES_PRIMEIRO"
    )
  );

  const ok = linhas.filter((l) => l.status === "ok").length;
  const curto = linhas.filter((l) => l.status === "curto").length;
  const faltando = linhas.filter((l) => l.status === "faltando").length;

  return {
    totalEsperado,
    linhasEsperadas: linhas.length,
    linhasNoBanco: questoes.length,
    ok,
    curto,
    faltando,
    prontaParaValidar: faltando === 0 && curto === 0 && linhas.length > 0,
    linhas,
  };
}

export function resumoExtracao(relatorio: RelatorioExtracaoProva): string {
  return `${relatorio.ok}/${relatorio.linhasEsperadas} OK · ${relatorio.curto} curto(s) · ${relatorio.faltando} faltando (mín. ${ENUNCIADO_VALIDACAO_MIN_CHARS} caracteres no enunciado)`;
}
