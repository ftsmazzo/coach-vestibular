"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card } from "@/components/ui";
import type { JornadaGraficos } from "@/lib/jornada-graficos";

const CORES_CLUSTER = [
  "#0d9488",
  "#6366f1",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
];

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

export function JornadaGraficos({ data }: { data: JornadaGraficos }) {
  const meta = data.metacognicao;

  const causasData =
    meta?.causas.map((c) => ({ name: c.label, value: c.count, pct: c.pct, fill: c.cor })) ?? [];

  const escoposData = data.topEscopos.slice(0, 8).map((e) => ({
    nome: truncar(e.escopoLabel, 28),
    completo: e.escopoLabel,
    materia: e.materiaLabel,
    erros: e.erros,
    taxaAcerto: e.taxaAcerto,
  }));

  const checkInData = meta?.checkIns ?? [];

  return (
    <div className="space-y-5">
      {/* KPIs */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi valor={`${data.pctAcertoPonderado}%`} label="Acerto ponderado da jornada" tom="text-teal-700" />
        <Kpi valor={String(data.totalRegistros)} label="Registros na jornada" />
        <Kpi
          valor={meta ? `${meta.pctErrosClassificados}%` : "—"}
          label="Erros que você classificou"
          tom={meta && meta.pctErrosClassificados < 40 ? "text-amber-600" : "text-slate-900"}
        />
        <Kpi
          valor={meta?.mediaCheckIn != null ? meta.mediaCheckIn.toFixed(1) : "—"}
          label="Energia média ao registrar"
          tom="text-violet-700"
        />
      </div>

      {/* Como você erra — donut */}
      <Card>
        <h2 className="text-base font-semibold text-slate-900">Como você erra</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Distribuição das causas dos erros que você classificou — não é matéria, é o tipo de falha.
        </p>
        {causasData.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Classifique o motivo dos erros ao registrar provas para ver este gráfico.
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
                  <span
                    className="h-3 w-3 shrink-0 rounded-full"
                    style={{ backgroundColor: c.fill }}
                  />
                  <span className="flex-1 text-slate-700">{c.name}</span>
                  <span className="font-medium text-slate-900">{c.pct}%</span>
                </li>
              ))}
            </ul>
          </div>
        )}
        {meta?.causaDominante && (
          <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs leading-relaxed text-slate-600">
            {meta.insight}
          </p>
        )}
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-slate-900">Escopos N2 com mais erro</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Focos do motor v1 na jornada — classifique provas no admin para preencher.
        </p>
        {escoposData.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">
            Registre provas do catálogo com escopo N2 classificado para ver os principais gargalos.
          </p>
        ) : (
          <div
            className="mt-3 w-full"
            style={{ height: Math.max(160, escoposData.length * 46) }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={escoposData} layout="vertical" margin={{ left: 4, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11 }} />
                <YAxis
                  type="category"
                  dataKey="nome"
                  width={130}
                  tick={{ fontSize: 10 }}
                  interval={0}
                />
                <Tooltip
                  wrapperStyle={TIP_WRAPPER}
                  contentStyle={TIP_CONTENT}
                  labelStyle={TIP_LABEL}
                  itemStyle={TIP_ITEM}
                  formatter={(v, _n, p) => {
                    const pay = p?.payload as { taxaAcerto?: number; materia?: string };
                    return [
                      `${v} erro(s) · ${pay?.taxaAcerto ?? 0}% acerto`,
                      pay?.materia ?? "",
                    ];
                  }}
                  labelFormatter={(_l, p) =>
                    (p?.[0]?.payload as { completo?: string })?.completo ?? ""
                  }
                />
                <Bar dataKey="erros" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Card>

      {/* Energia emocional — linha */}
      {checkInData.length >= 2 && (
        <Card>
          <h2 className="text-base font-semibold text-slate-900">Como você chegou nas provas</h2>
          <p className="mt-0.5 text-xs text-slate-500">
            Seu check-in emocional (1 a 5) a cada registro — corpo e mente também contam.
          </p>
          <div className="mt-3 h-48 w-full sm:h-52">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={checkInData} margin={{ left: -16, right: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="dataLabel" tick={{ fontSize: 10 }} />
                <YAxis domain={[1, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 11 }} />
                <Tooltip
                  wrapperStyle={TIP_WRAPPER}
                  contentStyle={TIP_CONTENT}
                  labelStyle={TIP_LABEL}
                  itemStyle={TIP_ITEM}
                  formatter={(v) => [`${v}/5`, "Energia"]}
                />
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}
    </div>
  );
}
