"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui";
import type { ExamGraficos as ExamGraficosData } from "@/lib/exam-graficos";

const TIP_WRAPPER = { zIndex: 50, maxWidth: 220, outline: "none" } as const;
const TIP_CONTENT = {
  maxWidth: 220,
  whiteSpace: "normal" as const,
  wordBreak: "break-word" as const,
  fontSize: 12,
  lineHeight: 1.35,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  boxShadow: "0 6px 16px rgba(15,23,42,0.12)",
};
const TIP_LABEL = {
  whiteSpace: "normal" as const,
  fontWeight: 600,
  color: "#0f172a",
  marginBottom: 4,
  display: "block",
};
const TIP_ITEM = { padding: 0 } as const;

function truncar(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n - 1)}…` : s;
}

function Kpi({ valor, label, tom }: { valor: string; label: string; tom?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-3">
      <p className={`text-2xl font-bold ${tom ?? "text-slate-900"}`}>{valor}</p>
      <p className="mt-0.5 text-xs leading-tight text-slate-500">{label}</p>
    </div>
  );
}

export function ExamGraficos({ data }: { data: ExamGraficosData }) {
  const causasData = data.causas.map((c) => ({
    name: c.label,
    value: c.count,
    pct: c.pct,
    fill: c.cor,
  }));

  const materiasData = data.materias.map((m) => ({
    nome: truncar(m.nome, 16),
    completo: m.nome,
    pct: m.pct,
    total: m.total,
  }));

  const conhecimentosData = data.conhecimentos.map((c) => ({
    nome: truncar(c.texto, 28),
    completo: c.texto,
    erros: c.erros,
  }));

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi valor={`${data.pctAcerto}%`} label="Acerto nesta prova" tom="text-teal-700" />
        <Kpi valor={`${data.acertos}/${data.total}`} label="Questões certas" />
        <Kpi valor={String(data.totalErros)} label="Erros nesta prova" tom="text-rose-600" />
        <Kpi
          valor={data.totalErros > 0 ? `${data.pctErrosClassificados}%` : "—"}
          label="Erros classificados"
          tom={
            data.totalErros > 0 && data.pctErrosClassificados < 60
              ? "text-amber-600"
              : "text-slate-900"
          }
        />
      </div>

      {materiasData.length > 0 && (
        <Card>
          <h2 className="text-base font-semibold text-slate-900">Acerto por matéria</h2>
          <p className="mt-0.5 text-xs text-slate-500">Só nesta prova — da menor para a maior.</p>
          <div className="mt-3 w-full" style={{ height: Math.max(150, materiasData.length * 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={materiasData} layout="vertical" margin={{ left: 4, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="nome" width={110} tick={{ fontSize: 10 }} interval={0} />
                <Tooltip
                  wrapperStyle={TIP_WRAPPER}
                  contentStyle={TIP_CONTENT}
                  labelStyle={TIP_LABEL}
                  itemStyle={TIP_ITEM}
                  formatter={(v, _n, p) => [
                    `${v}% (${(p?.payload as { total?: number })?.total ?? 0} questões)`,
                    "Acerto",
                  ]}
                  labelFormatter={(_l, p) =>
                    (p?.[0]?.payload as { completo?: string })?.completo ?? ""
                  }
                />
                <Bar dataKey="pct" fill="#0d9488" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      <Card>
        <h2 className="text-base font-semibold text-slate-900">Como você errou nesta prova</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Distribuição das causas dos erros classificados.
        </p>
        {causasData.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Classifique seus erros (na aba Questões) para ver este gráfico.
          </p>
        ) : (
          <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="h-48 w-full sm:h-52 sm:w-1/2">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={causasData}
                    dataKey="value"
                    nameKey="name"
                    innerRadius="55%"
                    outerRadius="85%"
                    paddingAngle={2}
                    strokeWidth={0}
                  >
                    {causasData.map((c) => (
                      <Cell key={c.name} fill={c.fill} />
                    ))}
                  </Pie>
                  <Tooltip
                    wrapperStyle={TIP_WRAPPER}
                    contentStyle={TIP_CONTENT}
                    labelStyle={TIP_LABEL}
                    itemStyle={TIP_ITEM}
                    formatter={(v, _n, p) => [
                      `${v} erro(s) · ${(p?.payload as { pct?: number })?.pct ?? 0}%`,
                      (p?.payload as { name?: string })?.name ?? "",
                    ]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <ul className="flex-1 space-y-1.5">
              {causasData.map((c) => (
                <li key={c.name} className="flex items-center gap-2 text-sm">
                  <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: c.fill }} />
                  <span className="flex-1 text-slate-700">{c.name}</span>
                  <span className="font-medium text-slate-900">{c.pct}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </Card>

      {conhecimentosData.length > 0 && (
        <Card>
          <h2 className="text-base font-semibold text-slate-900">Conhecimentos com mais erro</h2>
          <p className="mt-0.5 text-xs text-slate-500">O que mais pesou nesta prova.</p>
          <div
            className="mt-3 w-full"
            style={{ height: Math.max(150, conhecimentosData.length * 46) }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={conhecimentosData} layout="vertical" margin={{ left: 4, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="nome" width={130} tick={{ fontSize: 10 }} interval={0} />
                <Tooltip
                  wrapperStyle={TIP_WRAPPER}
                  contentStyle={TIP_CONTENT}
                  labelStyle={TIP_LABEL}
                  itemStyle={TIP_ITEM}
                  formatter={(v) => [`${v} erro(s)`, "Erros"]}
                  labelFormatter={(_l, p) =>
                    (p?.[0]?.payload as { completo?: string })?.completo ?? ""
                  }
                />
                <Bar dataKey="erros" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}
