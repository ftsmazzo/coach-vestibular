"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ComparativoVestibulares } from "@/lib/jornada-analytics";
import { getMateriaLabel } from "@/lib/taxonomy";

export function ComparativoVestibularesChart({
  comparativo,
}: {
  comparativo: ComparativoVestibulares | null;
}) {
  if (!comparativo) {
    return (
      <p className="text-sm text-slate-500">
        Registre pelo menos dois vestibulares oficiais para comparar evolução entre provas.
      </p>
    );
  }

  const { anterior, atual, deltas, deltaGeral } = comparativo;

  if (deltas.length === 0) {
    return (
      <div className="space-y-2 text-sm text-slate-600">
        <p>
          <strong>{anterior.label}</strong> ({anterior.dataLabel}) →{" "}
          <strong>{atual.label}</strong> ({atual.dataLabel})
        </p>
        <p>
          Geral: {anterior.pctGeral}% → {atual.pctGeral}% (
          {deltaGeral >= 0 ? "+" : ""}
          {deltaGeral}%)
        </p>
        <p className="text-slate-500">
          Não há matérias em comum com questões nas duas provas para comparar (ex.: provas com
          blocos diferentes).
        </p>
      </div>
    );
  }

  const keyAnt = "Penúltimo";
  const keyAtu = "Último";
  const chartData = deltas.map((d) => ({
    nome: d.label.length > 14 ? `${d.label.slice(0, 13)}…` : d.label,
    [keyAnt]: d.pctAnterior,
    [keyAtu]: d.pctAtual,
    delta: d.delta,
  }));

  return (
    <div className="space-y-4">
      <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
        <span className="font-medium">{anterior.label}</span> ({anterior.dataLabel},{" "}
        {anterior.pctGeral}%) → <span className="font-medium">{atual.label}</span> (
        {atual.dataLabel}, {atual.pctGeral}%) ·{" "}
        <span className={deltaGeral >= 0 ? "text-emerald-700" : "text-rose-700"}>
          {deltaGeral >= 0 ? "+" : ""}
          {deltaGeral}% no geral
        </span>
      </div>

      <div className="h-[200px] w-full sm:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ left: 4, right: 8, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="nome" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={56} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
            <Tooltip
              formatter={(v, name) => [`${v}%`, name]}
              labelFormatter={(label) => label}
            />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey={keyAnt} fill="#94a3b8" radius={[4, 4, 0, 0]} name={`${keyAnt} (${anterior.dataLabel})`} />
            <Bar dataKey={keyAtu} fill="#0d9488" radius={[4, 4, 0, 0]} name={`${keyAtu} (${atual.dataLabel})`} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[10px] text-slate-500">
        Só entram matérias que tiveram questões nas duas provas — evita “queda” falsa quando a
        matéria não caiu (ex.: Sociologia na Unesp).
      </p>

      {(comparativo.melhorias.length > 0 || comparativo.quedas.length > 0) && (
        <div className="grid gap-2 sm:grid-cols-2 text-xs">
          {comparativo.melhorias.length > 0 && (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-2">
              <p className="font-semibold text-emerald-900">Melhorou</p>
              <ul className="mt-1 space-y-0.5 text-emerald-800">
                {comparativo.melhorias.slice(0, 5).map((d) => (
                  <li key={d.materiaId}>
                    {getMateriaLabel(d.materiaId)} +{d.delta}%
                  </li>
                ))}
              </ul>
            </div>
          )}
          {comparativo.quedas.length > 0 && (
            <div className="rounded-lg border border-rose-100 bg-rose-50/60 p-2">
              <p className="font-semibold text-rose-900">Atenção</p>
              <ul className="mt-1 space-y-0.5 text-rose-800">
                {comparativo.quedas.slice(0, 5).map((d) => (
                  <li key={d.materiaId}>
                    {getMateriaLabel(d.materiaId)} {d.delta}%
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
