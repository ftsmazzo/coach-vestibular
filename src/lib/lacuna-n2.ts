/**
 * Detecção de lacuna por N2 — exposição + taxa de erro + recência.
 * Errar 1 questão não vira lacuna; distração não infla diagnóstico.
 */

export type TentativaN2 = {
  escopoId: string;
  correto: boolean;
  /** Dias desde a tentativa (0 = hoje) */
  diasAtras: number;
  peso?: number;
};

export type LacunaN2Config = {
  exposicaoMinima: number;
  taxaErroMinima: number;
  scoreMinimo: number;
  meiaVidaDias: number;
};

export const LACUNA_N2_DEFAULT: LacunaN2Config = {
  exposicaoMinima: 3,
  taxaErroMinima: 0.45,
  scoreMinimo: 0.22,
  meiaVidaDias: 30,
};

export type LacunaN2Resultado = {
  escopoId: string;
  tentativas: number;
  erros: number;
  taxaErro: number;
  score: number;
  ehLacuna: boolean;
  motivo: string;
};

function recenciaPeso(diasAtras: number, meiaVidaDias: number): number {
  return Math.exp(-(diasAtras / meiaVidaDias) * Math.LN2);
}

/** Agrega tentativas por escopoId e calcula score de lacuna. */
export function calcularLacunasN2(
  tentativas: TentativaN2[],
  config: LacunaN2Config = LACUNA_N2_DEFAULT
): LacunaN2Resultado[] {
  const porEscopo = new Map<string, { tentativas: number; erros: number; pesoRecencia: number }>();

  for (const t of tentativas) {
    const peso = t.peso ?? 1;
    const rec = recenciaPeso(t.diasAtras, config.meiaVidaDias);
    const entry = porEscopo.get(t.escopoId) ?? { tentativas: 0, erros: 0, pesoRecencia: 0 };
    entry.tentativas += peso;
    if (!t.correto) {
      entry.erros += peso;
      entry.pesoRecencia = Math.max(entry.pesoRecencia, rec);
    } else {
      entry.pesoRecencia = Math.max(entry.pesoRecencia, rec * 0.35);
    }
    porEscopo.set(t.escopoId, entry);
  }

  const resultados: LacunaN2Resultado[] = [];

  for (const [escopoId, agg] of porEscopo) {
    const tentativasN = agg.tentativas;
    const taxaErro = tentativasN > 0 ? agg.erros / tentativasN : 0;

    if (tentativasN < config.exposicaoMinima) {
      resultados.push({
        escopoId,
        tentativas: tentativasN,
        erros: agg.erros,
        taxaErro,
        score: 0,
        ehLacuna: false,
        motivo: `exposição ${tentativasN} < ${config.exposicaoMinima}`,
      });
      continue;
    }

    if (taxaErro < config.taxaErroMinima) {
      resultados.push({
        escopoId,
        tentativas: tentativasN,
        erros: agg.erros,
        taxaErro,
        score: 0,
        ehLacuna: false,
        motivo: `taxa erro ${(taxaErro * 100).toFixed(0)}% abaixo do limiar`,
      });
      continue;
    }

    const score = taxaErro * agg.pesoRecencia * Math.log1p(tentativasN);
    const ehLacuna = score >= config.scoreMinimo;

    resultados.push({
      escopoId,
      tentativas: tentativasN,
      erros: agg.erros,
      taxaErro,
      score,
      ehLacuna,
      motivo: ehLacuna ? "lacuna confirmada" : `score ${score.toFixed(3)} abaixo do mínimo`,
    });
  }

  return resultados.sort((a, b) => b.score - a.score);
}

/** Rollup N1: soma scores dos N2 filhos de um domínio. */
export function rollupDominio(
  lacunas: LacunaN2Resultado[],
  dominioId: string
): { dominioId: string; scoreTotal: number; escoposLacuna: string[] } {
  const filhos = lacunas.filter((l) => l.escopoId.startsWith(`${dominioId}.`) && l.ehLacuna);
  return {
    dominioId,
    scoreTotal: filhos.reduce((s, l) => s + l.score, 0),
    escoposLacuna: filhos.map((l) => l.escopoId),
  };
}
