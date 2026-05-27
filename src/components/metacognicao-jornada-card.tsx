"use client";

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MetacognicaoJornada } from "@/lib/jornada-metacognicao";
import { Card } from "@/components/ui";

const EMOJI_CHECKIN = ["😔", "😕", "😐", "🙂", "😊"];

function CheckInTimeline({ checkIns }: { checkIns: MetacognicaoJornada["checkIns"] }) {
  if (checkIns.length === 0) {
    return (
      <p className="flex h-full min-h-[140px] items-center justify-center text-center text-xs text-slate-500">
        Marque como se sentiu ao registrar cada prova (1–5).
      </p>
    );
  }

  const chartData = checkIns.map((c) => ({
    data: c.dataLabel.slice(0, 5),
    score: c.score,
    fill: c.score <= 2 ? "#f43f5e" : c.score >= 4 ? "#10b981" : "#6366f1",
  }));

  return (
    <div className="h-[160px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={chartData} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}>
          <XAxis dataKey="data" tick={{ fontSize: 10 }} stroke="#94a3b8" />
          <YAxis domain={[0, 5]} ticks={[1, 2, 3, 4, 5]} tick={{ fontSize: 10 }} stroke="#94a3b8" />
          <Tooltip
            formatter={(value) => [`${value}/5`, "Bem-estar"]}
            labelFormatter={(label) => `Aplicada ${label}`}
          />
          <Bar dataKey="score" radius={[6, 6, 0, 0]} maxBarSize={36}>
            {chartData.map((entry, i) => (
              <Cell key={i} fill={entry.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function MetacognicaoJornadaCard({ dados }: { dados: MetacognicaoJornada }) {
  const chartCausas = dados.causas.map((c) => ({
    name: c.label.length > 22 ? `${c.label.slice(0, 20)}…` : c.label,
    fullName: c.label,
    count: c.count,
    pct: c.pct,
    fill: c.cor,
  }));

  const emojiMedia =
    dados.mediaCheckIn != null
      ? EMOJI_CHECKIN[Math.min(4, Math.max(0, Math.round(dados.mediaCheckIn) - 1))]
      : null;

  return (
    <Card className="overflow-hidden border-violet-200/80 bg-gradient-to-br from-violet-50/90 via-white to-indigo-50/40 p-0 shadow-sm">
      <div className="border-b border-violet-100/80 px-4 py-3 sm:px-5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">
          Metacognição global
        </p>
        <h2 className="text-base font-semibold text-slate-900">
          Como você erra e como se sente na jornada
        </h2>
        <p className="mt-0.5 text-xs text-slate-600">{dados.insight}</p>
      </div>

      <div className="grid gap-4 p-4 sm:grid-cols-2 sm:p-5">
        <div className="rounded-xl bg-white/80 p-3 ring-1 ring-slate-100">
          <p className="text-xs font-medium text-slate-700">Causas dos erros (classificados)</p>
          {chartCausas.length === 0 ? (
            <p className="mt-6 text-center text-xs text-slate-500">
              Classifique erros na análise de cada prova para ver o gráfico.
            </p>
          ) : (
            <div className="mt-2 h-[180px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={chartCausas}
                  layout="vertical"
                  margin={{ top: 0, right: 8, left: 4, bottom: 0 }}
                >
                  <XAxis type="number" hide />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={108}
                    tick={{ fontSize: 10 }}
                    stroke="#64748b"
                  />
                  <Tooltip
                    formatter={(value, _n, props) => {
                      const p = props.payload as (typeof chartCausas)[0];
                      return [`${value} erros (${p.pct}%)`, p.fullName];
                    }}
                  />
                  <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={14}>
                    {chartCausas.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl bg-white/80 p-3 ring-1 ring-slate-100">
          <p className="text-xs font-medium text-slate-700">Check-in emocional após provas</p>
          <CheckInTimeline checkIns={dados.checkIns} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 border-t border-violet-100/80 bg-white/50 px-4 py-3 sm:px-5">
        <div className="text-center">
          <p className="text-lg font-bold text-violet-900">{dados.pctErrosClassificados}%</p>
          <p className="text-[10px] leading-tight text-slate-600">
            erros com causa marcada
            <span className="block text-slate-400">
              {dados.errosClassificados}/{dados.totalErros}
            </span>
          </p>
        </div>
        <div className="text-center">
          <p className="text-lg font-bold text-slate-900">
            {dados.mediaCheckIn != null ? (
              <>
                {emojiMedia} {dados.mediaCheckIn}
              </>
            ) : (
              "—"
            )}
          </p>
          <p className="text-[10px] text-slate-600">
            média bem-estar
            {dados.totalCheckIns > 0 && (
              <span className="block text-slate-400">{dados.totalCheckIns} registro(s)</span>
            )}
          </p>
        </div>
        <div className="text-center">
          <p className="truncate text-sm font-bold leading-tight text-indigo-900">
            {dados.causaDominante?.label ?? "—"}
          </p>
          <p className="text-[10px] text-slate-600">
            causa dominante
            {dados.causaDominante && (
              <span className="block text-indigo-600">{dados.causaDominante.pct}%</span>
            )}
          </p>
        </div>
      </div>
    </Card>
  );
}
