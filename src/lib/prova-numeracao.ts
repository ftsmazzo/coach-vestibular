export type ProvaNumeracaoMeta = {
  totalQuestoes: number;
  dia?: number | null;
  banca?: string;
  numerosCadastrados?: number[];
};

/** Faixa de numeração da prova (ex.: ENEM dia 2 → 91–180, não 1–90). */
export function resolverNumerosGradeProva(meta: ProvaNumeracaoMeta): number[] {
  const { totalQuestoes, dia, banca, numerosCadastrados = [] } = meta;
  if (totalQuestoes < 1) return [];

  const cad = [...new Set(numerosCadastrados)].filter((n) => n > 0).sort((a, b) => a - b);

  if (cad.length > 0) {
    const min = cad[0]!;
    const max = cad[cad.length - 1]!;
    if (min > 1) {
      const inicio = min;
      const fim = inicio + totalQuestoes - 1;
      if (max <= fim) {
        return Array.from({ length: totalQuestoes }, (_, i) => inicio + i);
      }
    }
    if (max - min + 1 === totalQuestoes) {
      return Array.from({ length: totalQuestoes }, (_, i) => min + i);
    }
    if (cad.length <= totalQuestoes + 5) {
      return Array.from({ length: totalQuestoes }, (_, i) => min + i);
    }
  }

  const bancaU = (banca ?? "").toUpperCase();
  if (dia === 2 && bancaU.includes("ENEM")) {
    return Array.from({ length: totalQuestoes }, (_, i) => 91 + i);
  }

  return Array.from({ length: totalQuestoes }, (_, i) => i + 1);
}

type RespostaNumerada = { numero: number; letra: string; confianca?: string };

/**
 * Ajusta gabarito lido como 1..N para a faixa real (ex.: 1–90 → 91–180 no ENEM dia 2).
 */
export function normalizarNumerosGabaritoExtraido<T extends RespostaNumerada>(
  respostas: T[],
  numerosEsperados: number[]
): { respostas: T[]; deslocamento?: number; aviso?: string } {
  if (respostas.length === 0 || numerosEsperados.length === 0) {
    return { respostas };
  }

  const esperadoSet = new Set(numerosEsperados);
  const jaAlinhadas = respostas.filter((r) => esperadoSet.has(r.numero)).length;
  if (jaAlinhadas >= Math.max(1, respostas.length * 0.4)) {
    return { respostas: respostas.filter((r) => esperadoSet.has(r.numero)) };
  }

  const nums = respostas.map((r) => r.numero).sort((a, b) => a - b);
  const minLida = nums[0]!;
  const inicioEsperado = numerosEsperados[0]!;
  const offset = inicioEsperado - minLida;

  if (offset === 0) return { respostas };

  const deslocadas = respostas
    .map((r) => ({ ...r, numero: r.numero + offset }))
    .filter((r) => esperadoSet.has(r.numero));

  if (deslocadas.length >= Math.max(1, respostas.length * 0.4)) {
    const fimEsperado = numerosEsperados[numerosEsperados.length - 1]!;
    return {
      respostas: deslocadas,
      deslocamento: offset,
      aviso: `Numeração ajustada +${offset} (${minLida}–${nums[nums.length - 1]!} → ${inicioEsperado}–${fimEsperado}).`,
    };
  }

  return { respostas };
}

export function normalizarMapaGabarito(
  mapa: Map<number, string>,
  numerosEsperados: number[]
): Map<number, string> {
  const { respostas } = normalizarNumerosGabaritoExtraido(
    [...mapa.entries()].map(([numero, letra]) => ({ numero, letra })),
    numerosEsperados
  );
  return new Map(respostas.map((r) => [r.numero, r.letra.toUpperCase()]));
}

/** Ajusta lista de números (ex.: erros informados como 1–90 → 91–180). */
export function normalizarNumerosInformados(
  numeros: number[],
  numerosEsperados: number[]
): number[] {
  if (numeros.length === 0 || numerosEsperados.length === 0) return numeros;
  const { respostas } = normalizarNumerosGabaritoExtraido(
    numeros.map((numero) => ({ numero, letra: "" })),
    numerosEsperados
  );
  return respostas.map((r) => r.numero);
}

export function labelFaixaNumeracao(numeros: number[]): string {
  if (numeros.length === 0) return "";
  const a = numeros[0]!;
  const b = numeros[numeros.length - 1]!;
  return a === b ? `questão ${a}` : `questões ${a} a ${b}`;
}
