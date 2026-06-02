"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, Badge } from "@/components/ui";

export type CicloProgressaoItem = {
  indice: number;
  metaTitulo: string;
  metaMateria: string | null;
  quizPct: number | null;
  baselinePct: number | null;
  deltaPct: number | null;
};

const TIP_WRAPPER = { zIndex: 50, maxWidth: 220, outline: "none" } as const;
const TIP_CONTENT = {
  maxWidth: 220,
  whiteSpace: "normal" as const,
  wordBreak: "break-word" as const,
  fontSize: 12,
  padding: "8px 10px",
  borderRadius: 10,
  border: "1px solid #e2e8f0",
  boxShadow: "0 6px 16px rgba(15,23,42,0.12)",
};
const TIP_LABEL = { whiteSpace: "normal" as const, fontWeight: 600, color: "#0f172a" };

export function CiclosProgressao({ ciclos }: { ciclos: CicloProgressaoItem[] }) {
  // Ordena do mais antigo ao mais recente para a linha.
  const ordenados = [...ciclos].sort((a, b) => a.indice - b.indice);
  const comQuiz = ordenados.filter((c) => c.quizPct != null);

  const data = comQuiz.map((c) => ({
    nome: `Ciclo ${c.indice}`,
    pct: c.quizPct as number,
    meta: c.metaTitulo,
  }));

  return (
    <Card>
      <h2 className="text-base font-semibold text-slate-900">Evolução dos ciclos</h2>
      <p className="mt-0.5 text-xs text-slate-500">
        Mini-quiz de fechamento por ciclo. É um sinal direcional — a prova real confirma.
      </p>

      {data.length >= 2 ? (
        <div className="mt-3 h-48 w-full sm:h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ left: -16, right: 8 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="nome" tick={{ fontSize: 10 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip
                wrapperStyle={TIP_WRAPPER}
                contentStyle={TIP_CONTENT}
                labelStyle={TIP_LABEL}
                formatter={(v) => [`${v}%`, "Mini-quiz"]}
                labelFormatter={(l, p) => {
                  const meta = (p?.[0]?.payload as { meta?: string })?.meta;
                  return meta ? `${l} — ${meta}` : String(l);
                }}
              />
              <Line type="monotone" dataKey="pct" stroke="#7c3aed" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : null}

      <ul className="mt-3 space-y-2">
        {ordenados
          .slice()
          .reverse()
          .map((c) => {
            const tom =
              c.deltaPct == null
                ? "neutral"
                : c.deltaPct > 0
                  ? "success"
                  : c.deltaPct < 0
                    ? "warning"
                    : "neutral";
            return (
              <li
                key={c.indice}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-100 px-3 py-2 text-sm"
              >
                <div className="min-w-0">
                  <span className="font-medium text-slate-800">Ciclo {c.indice}</span>
                  <span className="text-slate-500"> · {c.metaTitulo}</span>
                </div>
                <div className="flex items-center gap-2">
                  {c.quizPct != null ? (
                    <span className="font-medium text-slate-900">{c.quizPct}%</span>
                  ) : (
                    <span className="text-xs text-slate-400">sem quiz</span>
                  )}
                  {c.deltaPct != null && (
                    <Badge tone={tom}>
                      {c.deltaPct > 0 ? `+${c.deltaPct}` : c.deltaPct} pts
                    </Badge>
                  )}
                </div>
              </li>
            );
          })}
      </ul>
    </Card>
  );
}
