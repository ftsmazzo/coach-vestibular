"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MateriaMediaJornada, MateriaSerieProva } from "@/lib/jornada-analytics";
import { getMateriaLabel } from "@/lib/taxonomy";

const CORES = [
  "#0d9488",
  "#6366f1",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#14b8a6",
  "#ec4899",
];

export function MateriaJornadaCharts({
  materiasMedia,
  seriesPorProva,
  materiaIdsOrdenados,
}: {
  materiasMedia: MateriaMediaJornada[];
  seriesPorProva: MateriaSerieProva[];
  materiaIdsOrdenados: string[];
}) {
  const barData = materiasMedia.map((m) => ({
    nome: m.label.length > 12 ? `${m.label.slice(0, 11)}…` : m.label,
    pct: m.pctAcerto,
  }));

  const topMaterias = materiaIdsOrdenados.slice(0, 5);
  const lineData = seriesPorProva.map((s) => {
    const row: Record<string, string | number> = {
      data: s.dataLabel,
      Geral: s.pctGeral,
    };
    for (const mid of topMaterias) {
      row[getMateriaLabel(mid)] = s.materias[mid] ?? 0;
    }
    return row;
  });

  if (barData.length === 0) {
    return <p className="text-sm text-slate-500">Registre provas com gabarito para ver matérias.</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <h3 className="mb-1 text-sm font-semibold text-slate-800">
          Média ponderada por matéria (toda a jornada)
        </h3>
        <p className="mb-3 text-xs text-slate-500">
          Oficiais pesam mais; inclui simulados e listas.
        </p>
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={barData} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
              <YAxis type="category" dataKey="nome" width={100} tick={{ fontSize: 10 }} />
              <Tooltip formatter={(v) => [`${v}%`, "Acerto"]} />
              <Bar dataKey="pct" fill="#0d9488" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {lineData.length >= 2 && topMaterias.length > 0 && (
        <div>
          <h3 className="mb-1 text-sm font-semibold text-slate-800">
            Evolução por matéria (por registro)
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            Compare se está melhorando em cada prova/simulado.
          </p>
          <div className="h-72 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [`${v}%`, ""]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Line type="monotone" dataKey="Geral" stroke="#334155" strokeWidth={2} dot />
                {topMaterias.map((mid, i) => (
                  <Line
                    key={mid}
                    type="monotone"
                    dataKey={getMateriaLabel(mid)}
                    stroke={CORES[i % CORES.length]}
                    strokeWidth={1.5}
                    dot={{ r: 3 }}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
