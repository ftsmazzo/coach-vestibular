import { resolverNumerosGradeProva } from "./prova-numeracao";

export type StatsQuestoesMeta = {
  dia?: number | null;
  banca?: string;
};

/** Estatísticas de cobertura do banco de questões vs faixa esperada (ex.: ENEM dia 2 → 91–180). */
export function statsQuestoesProva(
  questoes: { numero: number }[],
  totalEsperado: number,
  meta?: StatsQuestoesMeta
): {
  cadastradas: number;
  maiorNumero: number;
  faltando: number[];
  incompleto: boolean;
} {
  const cadastradas = questoes.length;
  const numerosSet = new Set(questoes.map((q) => q.numero));
  const maiorNumero = cadastradas > 0 ? Math.max(...numerosSet) : 0;

  const esperados = resolverNumerosGradeProva({
    totalQuestoes: totalEsperado,
    dia: meta?.dia,
    banca: meta?.banca,
    numerosCadastrados: questoes.map((q) => q.numero),
  });

  const faltando = esperados.filter((n) => !numerosSet.has(n));
  const incompleto = faltando.length > 0;

  return {
    cadastradas,
    maiorNumero,
    faltando,
    incompleto,
  };
}
