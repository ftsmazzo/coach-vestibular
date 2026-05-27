/**
 * KPIs de evolução relativa ao histórico do próprio aluno (% acerto).
 * Mede tendência e consistência — não aprovação absoluta no vestibular.
 */

export interface PontoExecucao {
  id: string;
  label: string;
  dataLabel: string;
  pct: number;
}

export type TendenciaKpi = "subindo" | "estavel" | "caindo";

export interface KpiExecucao {
  /** Índice na série cronológica (0 = primeira) */
  indice: number;
  pct: number;
  label: string;
  dataLabel: string;
  /** Média das execuções anteriores (null na 1ª) */
  mediaAnteriores: number | null;
  /** pct - mediaAnteriores */
  deltaVsMedia: number | null;
  /** Inclinação média por salto (última - primeira) / (n-1) na série até aqui */
  inclinacaoSerie: number | null;
  tendenciaSerie: TendenciaKpi | null;
  /** % das execuções anteriores que esta supera (100 = melhor que todas) */
  percentilVsAnteriores: number | null;
  /** z-score vs anteriores (precisa ≥3 pontos anteriores para σ estável) */
  zScore: number | null;
  melhorAteAqui: boolean;
  execucaoNumero: number;
  totalAteAqui: number;
}

function media(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

function desvioPadrao(nums: number[]): number {
  if (nums.length < 2) return 0;
  const m = media(nums);
  const v = nums.reduce((s, x) => s + (x - m) ** 2, 0) / (nums.length - 1);
  return Math.sqrt(v);
}

function tendenciaDeInclinacao(incl: number | null): TendenciaKpi | null {
  if (incl == null) return null;
  if (incl >= 1.5) return "subindo";
  if (incl <= -1.5) return "caindo";
  return "estavel";
}

/** Uma linha da tabela de evolução — KPI no momento de cada execução. */
export function serieKpiExecucoes(pontos: PontoExecucao[]): KpiExecucao[] {
  if (pontos.length === 0) return [];

  const out: KpiExecucao[] = [];
  const anteriores: number[] = [];

  for (let i = 0; i < pontos.length; i++) {
    const p = pontos[i]!;
    const mediaAnt = anteriores.length > 0 ? media(anteriores) : null;
    const deltaVsMedia =
      mediaAnt != null ? Math.round((p.pct - mediaAnt) * 10) / 10 : null;

    const serieAteAqui = [...anteriores, p.pct];
    let inclinacaoSerie: number | null = null;
    if (serieAteAqui.length >= 2) {
      inclinacaoSerie =
        Math.round(
          ((serieAteAqui[serieAteAqui.length - 1]! - serieAteAqui[0]!) /
            (serieAteAqui.length - 1)) *
            10
        ) / 10;
    }

    let percentilVsAnteriores: number | null = null;
    if (anteriores.length > 0) {
      const abaixo = anteriores.filter((x) => p.pct > x).length;
      percentilVsAnteriores = Math.round((abaixo / anteriores.length) * 100);
    }

    let zScore: number | null = null;
    if (anteriores.length >= 3) {
      const m = media(anteriores);
      const s = desvioPadrao(anteriores);
      if (s > 0.5) {
        zScore = Math.round(((p.pct - m) / s) * 100) / 100;
      }
    }

    const melhorAteAqui =
      anteriores.length === 0 || p.pct > Math.max(...anteriores);

    out.push({
      indice: i,
      pct: p.pct,
      label: p.label,
      dataLabel: p.dataLabel,
      mediaAnteriores: mediaAnt != null ? Math.round(mediaAnt * 10) / 10 : null,
      deltaVsMedia,
      inclinacaoSerie,
      tendenciaSerie: tendenciaDeInclinacao(inclinacaoSerie),
      percentilVsAnteriores,
      zScore,
      melhorAteAqui,
      execucaoNumero: i + 1,
      totalAteAqui: i + 1,
    });

    anteriores.push(p.pct);
  }

  return out;
}

export function ultimoKpi(serie: KpiExecucao[]): KpiExecucao | null {
  return serie.length > 0 ? serie[serie.length - 1]! : null;
}

export function formatarDelta(delta: number | null): string {
  if (delta == null) return "—";
  const s = delta > 0 ? "+" : "";
  return `${s}${delta} p.p.`;
}

export function labelPercentil(p: number | null): string {
  if (p == null) return "Primeira execução";
  if (p >= 100) return "Melhor que todas as anteriores";
  if (p >= 75) return "Acima de 3 em cada 4 anteriores";
  if (p >= 50) return "Na metade superior do histórico";
  if (p >= 25) return "Abaixo da mediana do histórico";
  return "Uma das piores até aqui";
}
