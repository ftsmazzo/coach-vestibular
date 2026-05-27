"use client";

import { Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import type { AreaBlocoMediaJornada } from "@/lib/jornada-analytics";

const CORES_AREA: Record<string, string> = {
  linguagens: "#6366f1",
  humanas: "#f59e0b",
  natureza: "#10b981",
  exatas: "#0d9488",
};

export function AreaBlocoPieChart({ areas }: { areas: AreaBlocoMediaJornada[] }) {
  const comQuestoes = areas.filter((a) => a.totalQuestoes > 0);
  if (comQuestoes.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        Registre provas com gabarito para ver o desempenho por grande área.
      </p>
    );
  }

  const data = comQuestoes.map((a) => ({
    name: a.label.replace("Ciências ", "").replace("Línguas e códigos", "Línguas"),
    areaId: a.areaId,
    questoes: a.totalQuestoes,
    pct: a.pctAcerto,
    fill: CORES_AREA[a.areaId] ?? "#94a3b8",
  }));

  return (
    <div className="h-[220px] w-full sm:h-[280px]">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="questoes"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={52}
            outerRadius={88}
            paddingAngle={2}
          >
            {data.map((entry) => (
              <Cell key={entry.areaId} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, _name, props) => {
              const p = props.payload as (typeof data)[0];
              return [
                `${p.pct}% acerto · ${value} questões na jornada`,
                p.name,
              ];
            }}
          />
          <Legend
            formatter={(value, entry) => {
              const p = entry.payload as (typeof data)[0] | undefined;
              return p ? `${value} (${p.pct}%)` : value;
            }}
            wrapperStyle={{ fontSize: 11 }}
          />
        </PieChart>
      </ResponsiveContainer>
      <p className="mt-1 text-center text-[10px] text-slate-500">
        Tamanho da fatia = quantidade de questões · rótulo = % de acerto na área
      </p>
    </div>
  );
}
