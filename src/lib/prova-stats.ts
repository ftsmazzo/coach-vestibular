/** Estatísticas de cobertura do banco de questões vs total esperado da prova */
export function statsQuestoesProva(
  questoes: { numero: number }[],
  totalEsperado: number
): {
  cadastradas: number;
  maiorNumero: number;
  faltando: number[];
  incompleto: boolean;
} {
  const cadastradas = questoes.length;
  const numeros = new Set(questoes.map((q) => q.numero));
  const maiorNumero = cadastradas > 0 ? Math.max(...numeros) : 0;

  const faltando: number[] = [];
  const limite = Math.max(totalEsperado, maiorNumero);
  for (let n = 1; n <= limite; n++) {
    if (!numeros.has(n)) faltando.push(n);
  }

  const faltandoNoEsperado = faltando.filter((n) => n <= totalEsperado);
  const incompleto =
    cadastradas < totalEsperado || faltandoNoEsperado.length > 0;

  return {
    cadastradas,
    maiorNumero,
    faltando: faltandoNoEsperado,
    incompleto,
  };
}
