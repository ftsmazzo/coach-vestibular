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

const KEY_PENULTIMO = "Penúltimo";
const KEY_ULTIMO = "Último";

type TooltipEntry = {
  dataKey?: string | number;
  value?: number | string;
  color?: string;
};

type TooltipComparativoProps = {
  active?: boolean;
  payload?: ReadonlyArray<TooltipEntry>;
  label?: string | number;
  dataPenultimo: string;
  dataUltimo: string;
};

function TooltipComparativo({
  active,
  payload,
  label,
  dataPenultimo,
  dataUltimo,
}: TooltipComparativoProps) {
  if (!active || !payload?.length) return null;

  const rotuloSerie = (entry: TooltipEntry) =>
    entry.dataKey === KEY_ULTIMO ? `Último · ${dataUltimo}` : `Penúltimo · ${dataPenultimo}`;

  return (
    <div className="pointer-events-none w-[min(200px,calc(100vw-2.5rem))] rounded-lg border border-slate-200 bg-white/95 px-2.5 py-2 text-[11px] leading-snug shadow-lg backdrop-blur-sm">
      <p className="truncate font-semibold text-slate-900">
        {label != null ? String(label) : ""}
      </p>
      <ul className="mt-1.5 space-y-1">
        {payload.map((entry) => (
          <li key={String(entry.dataKey)} className="flex items-center gap-2">
            <span
              className="h-2 w-2 shrink-0 rounded-sm"
              style={{ backgroundColor: entry.color }}
              aria-hidden
            />
            <span className="min-w-0 flex-1 truncate text-slate-600">{rotuloSerie(entry)}</span>
            <span className="shrink-0 font-semibold tabular-nums text-slate-900">
              {entry.value}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

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

  const chartData = deltas.map((d) => ({
    nome: d.label.length > 14 ? `${d.label.slice(0, 13)}…` : d.label,
    [KEY_PENULTIMO]: d.pctAnterior,
    [KEY_ULTIMO]: d.pctAtual,
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

      <div className="h-[200px] w-full max-w-full overflow-hidden sm:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ left: 4, right: 12, bottom: 4, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="nome" tick={{ fontSize: 10 }} interval={0} angle={-25} textAnchor="end" height={56} />
            <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} width={28} />
            <Tooltip
              allowEscapeViewBox={{ x: false, y: true }}
              offset={8}
              wrapperStyle={{ outline: "none", zIndex: 20 }}
              cursor={{ fill: "rgba(15, 118, 110, 0.08)" }}
              content={(props) => (
                <TooltipComparativo
                  active={props.active}
                  payload={props.payload}
                  label={props.label}
                  dataPenultimo={anterior.dataLabel}
                  dataUltimo={atual.dataLabel}
                />
              )}
            />
            <Legend
              wrapperStyle={{ fontSize: 10, lineHeight: 1.2, paddingTop: 4 }}
              formatter={(value) => {
                if (value === KEY_PENULTIMO) return `${KEY_PENULTIMO} (${anterior.dataLabel})`;
                if (value === KEY_ULTIMO) return `${KEY_ULTIMO} (${atual.dataLabel})`;
                return value;
              }}
            />
            <Bar
              dataKey={KEY_PENULTIMO}
              fill="#94a3b8"
              radius={[4, 4, 0, 0]}
              name={KEY_PENULTIMO}
            />
            <Bar dataKey={KEY_ULTIMO} fill="#0d9488" radius={[4, 4, 0, 0]} name={KEY_ULTIMO} />
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
