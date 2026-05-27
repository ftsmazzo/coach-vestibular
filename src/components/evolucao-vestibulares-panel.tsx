"use client";

import type { EvolucaoVestibularesKpi } from "@/lib/jornada-analytics";
import { formatarDelta } from "@/lib/kpi-evolucao";
import { EvolutionChart } from "@/components/evolution-chart";
import { Card } from "@/components/ui";

export function EvolucaoVestibularesPanel({
  evolucao,
}: {
  evolucao: EvolucaoVestibularesKpi | null;
}) {
  if (!evolucao || evolucao.chart.length === 0) return null;

  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold text-slate-900">Progressão nos vestibulares oficiais</h3>
      <p className="mb-4 text-xs text-slate-500">
        Cada ponto é um vestibular registrado. Os KPIs comparam o último com todo o histórico
        anterior — não só com a prova imediatamente anterior.
      </p>

      {evolucao.chart.length >= 2 && (
        <div className="mb-4 h-52 w-full">
          <EvolutionChart
            data={evolucao.chart}
            emptyMessage="Registre mais vestibulares oficiais."
          />
        </div>
      )}

      {evolucao.serie.length >= 2 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead>
              <tr className="border-b text-slate-500">
                <th className="py-2 pr-2">#</th>
                <th className="py-2 pr-2">Prova</th>
                <th className="py-2 pr-2">%</th>
                <th className="py-2 pr-2">vs média ant.</th>
                <th className="py-2">Percentil</th>
              </tr>
            </thead>
            <tbody>
              {evolucao.serie.map((k) => (
                <tr key={k.indice} className="border-b border-slate-100">
                  <td className="py-2 pr-2 text-slate-500">{k.execucaoNumero}</td>
                  <td className="py-2 pr-2 font-medium text-slate-800">
                    {k.label}
                    <span className="ml-1 font-normal text-slate-500">{k.dataLabel}</span>
                  </td>
                  <td className="py-2 pr-2">{k.pct}%</td>
                  <td
                    className={`py-2 pr-2 ${
                      (k.deltaVsMedia ?? 0) > 0
                        ? "text-emerald-700"
                        : (k.deltaVsMedia ?? 0) < 0
                          ? "text-rose-700"
                          : ""
                    }`}
                  >
                    {formatarDelta(k.deltaVsMedia)}
                  </td>
                  <td className="py-2">
                    {k.percentilVsAnteriores != null ? `${k.percentilVsAnteriores}%` : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
