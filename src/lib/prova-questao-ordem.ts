import type { ProvaQuestaoRow } from "@/lib/parse-prova-csv";

/** Chave estável para observações humanas na reextração (por ordem física). */
export function chaveOrdemExtracao(ordemExtracao: number): string {
  return `ordem:${ordemExtracao}`;
}

export function compararPorOrdemExtracao(
  a: { ordemExtracao?: number | null },
  b: { ordemExtracao?: number | null }
): number {
  const oa = a.ordemExtracao ?? 0;
  const ob = b.ordemExtracao ?? 0;
  if (oa !== ob) return oa - ob;
  return 0;
}

export function ordenarRowsExtracao<T extends { ordemExtracao?: number | null }>(rows: T[]): T[] {
  return [...rows].sort(compararPorOrdemExtracao);
}

/** Garante ordemExtracao 1..N quando ausente (CSV legado). */
export function atribuirOrdemExtracaoSequencial(rows: ProvaQuestaoRow[]): ProvaQuestaoRow[] {
  return rows.map((r, i) => ({
    ...r,
    ordemExtracao: r.ordemExtracao ?? i + 1,
  }));
}
