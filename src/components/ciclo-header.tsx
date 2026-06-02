import Link from "next/link";
import { Card, Badge } from "@/components/ui";
import type { CicloResumo } from "@/lib/ciclo";

export function CicloHeader({ ciclo }: { ciclo: CicloResumo }) {
  const prazoTom = ciclo.expirado
    ? "danger"
    : ciclo.diasRestantes <= 2
      ? "warning"
      : "neutral";
  const prazoLabel = ciclo.expirado
    ? "Ciclo encerrado — hora de fechar"
    : ciclo.diasRestantes === 0
      ? "Último dia"
      : `${ciclo.diasRestantes} dia${ciclo.diasRestantes > 1 ? "s" : ""} restante${ciclo.diasRestantes > 1 ? "s" : ""}`;

  return (
    <Card className="border-teal-200 bg-gradient-to-br from-teal-50 to-white">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-800">
            Ciclo {ciclo.indice} · sua semana
          </p>
          <h2 className="mt-0.5 text-base font-bold text-slate-900 sm:text-lg">
            Meta: {ciclo.metaTitulo}
          </h2>
          {ciclo.metaMateria && (
            <p className="text-xs text-slate-500">Foco em {ciclo.metaMateria}</p>
          )}
        </div>
        <Badge tone={prazoTom}>{prazoLabel}</Badge>
      </div>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-slate-600">
          <span>
            {ciclo.feitas} de {ciclo.total} tarefas
          </span>
          <span className="font-medium text-teal-800">{ciclo.pctConcluido}%</span>
        </div>
        <div className="mt-1 h-2 overflow-hidden rounded-full bg-teal-100">
          <div
            className="h-full rounded-full bg-teal-600 transition-all"
            style={{ width: `${ciclo.pctConcluido}%` }}
          />
        </div>
      </div>

      <div className="mt-3">
        <Link
          href="/ciclo/fechar"
          className={`inline-flex items-center rounded-lg px-3 py-2 text-sm font-medium ${
            ciclo.expirado
              ? "bg-teal-600 text-white hover:bg-teal-700"
              : "text-teal-700 hover:underline"
          }`}
        >
          {ciclo.expirado ? "Fechar ciclo e avaliar →" : "Fechar ciclo agora (mini-quiz) →"}
        </Link>
      </div>
    </Card>
  );
}
