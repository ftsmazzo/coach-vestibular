import { resolverNumerosGradeProva } from "./prova-numeracao";
import {
  chaveQuestaoVariante,
  faixaIdiomaProva,
  temDuplicataEnEs,
  variantesExigidasPorNumero,
  type MetaPoliticaIdiomas,
} from "./prova-idioma";

export type StatsQuestoesMeta = MetaPoliticaIdiomas & {
  dia?: number | null;
  banca?: string;
};

/** Estatísticas de cobertura do banco vs faixa lógica que o aluno responde. */
export function statsQuestoesProva(
  questoes: { numero: number; idiomaVariante?: string | null }[],
  totalEsperado: number,
  meta?: StatsQuestoesMeta
): {
  cadastradas: number;
  linhasBanco: number;
  maiorNumero: number;
  faltando: number[];
  incompleto: boolean;
} {
  const linhasBanco = questoes.length;
  const numerosSet = new Set(questoes.map((q) => q.numero));
  const maiorNumero = numerosSet.size > 0 ? Math.max(...numerosSet) : 0;

  const presentes = new Set(
    questoes.map((q) => chaveQuestaoVariante(q.numero, q.idiomaVariante ?? "COMUM"))
  );

  const esperados = resolverNumerosGradeProva({
    totalQuestoes: totalEsperado,
    dia: meta?.dia,
    banca: meta?.banca,
    numerosCadastrados: questoes.map((q) => q.numero),
  });

  const faltando: number[] = [];
  for (const n of esperados) {
    const variantes = variantesExigidasPorNumero(n, meta ?? {});
    const ok = variantes.every((v) => presentes.has(chaveQuestaoVariante(n, v)));
    if (!ok) faltando.push(n);
  }

  const cadastradas = temDuplicataEnEs(meta)
    ? esperados.length - faltando.length
    : new Set(questoes.map((q) => q.numero)).size;

  return {
    cadastradas,
    linhasBanco,
    maiorNumero,
    faltando,
    incompleto: faltando.length > 0,
  };
}

/** Faixa opcional para UI (admin / aluno). */
export function metaIdiomaParaUi(meta?: MetaPoliticaIdiomas) {
  const faixa = faixaIdiomaProva(meta);
  return {
    politicaIdiomas: meta?.politicaIdiomas ?? "NENHUMA",
    temDuplicataEnEs: temDuplicataEnEs(meta),
    faixaIdioma: faixa,
    exigeEscolhaIdioma: temDuplicataEnEs(meta),
  };
}
