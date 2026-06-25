import type { IdiomaVarianteQuestao } from "@/generated/prisma/client";
import {
  ENUNCIADO_VALIDACAO_MIN_CHARS,
  extracaoAceitaPorObservacao,
  sanitizarTextoProva,
  statusEnunciadoExtracao,
  type StatusExtracaoQuestao,
} from "@/lib/prova-texto-prova";
import {
  chaveQuestaoVariante,
  compararQuestoesPorNumeroEOrdem,
  temDuplicataEnEs,
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
  aceitoManualmente?: boolean;
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
  observacoes?: string | null;
};

/** Se o banco tem linhas EN/ES mas a prova ainda não tem politicaIdiomas gravada, infere a faixa. */
export function inferirMetaPoliticaIdiomas(
  questoes: QuestaoDb[],
  meta: MetaPoliticaIdiomas
): MetaPoliticaIdiomas {
  if (temDuplicataEnEs(meta)) return meta;

  const numerosComVariante = new Set<number>();
  for (const q of questoes) {
    const v = q.idiomaVariante ?? "COMUM";
    if (v === "INGLES" || v === "ESPANHOL") numerosComVariante.add(q.numero);
  }
  if (numerosComVariante.size === 0) return meta;

  const nums = [...numerosComVariante].sort((a, b) => a - b);
  return {
    ...meta,
    politicaIdiomas: "DUPLICATA_EN_ES",
    idiomaQuestaoInicio: meta.idiomaQuestaoInicio ?? nums[0],
    idiomaQuestaoFim: meta.idiomaQuestaoFim ?? nums[nums.length - 1],
    ordemIdiomasFaixa: meta.ordemIdiomasFaixa ?? "INGLES_PRIMEIRO",
  };
}

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
    numerosCadastrados: questoes
      .filter((q) => (q.idiomaVariante ?? "COMUM") === "COMUM")
      .map((q) => q.numero),
  });

  /** Extração pura: 1 slot COMUM por número lógico (trilhas EN/ES vêm após N1). */
  const slots: Array<{ numero: number; idiomaVariante: IdiomaVarianteQuestao }> = numeros.map(
    (n) => ({ numero: n, idiomaVariante: "COMUM" as const })
  );

  const linhas: LinhaExtracaoRelatorio[] = slots.map(({ numero, idiomaVariante }) => {
    const chave = chaveQuestaoVariante(numero, idiomaVariante);
    const q = porChave.get(chave);
    const en = sanitizarTextoProva(q?.enunciado);
    const alt = sanitizarTextoProva(q?.alternativas);
    const aceitoManual = extracaoAceitaPorObservacao(q?.observacoes);
    const status = q
      ? statusEnunciadoExtracao(en, ENUNCIADO_VALIDACAO_MIN_CHARS, { aceitoManual })
      : "faltando";
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
      aceitoManualmente: aceitoManual && status === "ok",
    };
  });

  linhas.sort((a, b) =>
    compararQuestoesPorNumeroEOrdem(
      { numero: a.numero, idiomaVariante: a.idiomaVariante },
      { numero: b.numero, idiomaVariante: b.idiomaVariante }
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
