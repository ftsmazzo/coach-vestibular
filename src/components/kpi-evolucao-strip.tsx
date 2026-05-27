import type { KpiExecucao } from "@/lib/kpi-evolucao";
import { formatarDelta, labelPercentil } from "@/lib/kpi-evolucao";
import { Card } from "@/components/ui";

export function KpiEvolucaoStrip({
  kpi,
  contexto = "última execução",
}: {
  kpi: KpiExecucao | null;
  contexto?: string;
}) {
  if (!kpi) return null;

  const deltaTone =
    kpi.deltaVsMedia == null
      ? "text-slate-600"
      : kpi.deltaVsMedia > 0
        ? "text-emerald-700"
        : kpi.deltaVsMedia < 0
          ? "text-rose-700"
          : "text-slate-600";

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500">
        KPIs de evolução — {contexto} ({kpi.execucaoNumero}ª de {kpi.totalAteAqui} no histórico
        desta série)
      </p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="p-3">
          <p className="text-[10px] font-medium uppercase text-slate-500">vs média anterior</p>
          <p className={`mt-1 text-xl font-bold ${deltaTone}`}>
            {formatarDelta(kpi.deltaVsMedia)}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            {kpi.mediaAnteriores != null
              ? `Média antes: ${kpi.mediaAnteriores}% · agora ${kpi.pct}%`
              : "Primeiro registro desta série"}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] font-medium uppercase text-slate-500">Tendência da série</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {kpi.tendenciaSerie === "subindo"
              ? "Em alta"
              : kpi.tendenciaSerie === "caindo"
                ? "Em queda"
                : kpi.tendenciaSerie === "estavel"
                  ? "Estável"
                  : "—"}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            {kpi.inclinacaoSerie != null
              ? `~${kpi.inclinacaoSerie > 0 ? "+" : ""}${kpi.inclinacaoSerie} p.p. por prova`
              : "Precisa de 2+ execuções"}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] font-medium uppercase text-slate-500">Percentil pessoal</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {kpi.percentilVsAnteriores != null ? `${kpi.percentilVsAnteriores}%` : "—"}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">{labelPercentil(kpi.percentilVsAnteriores)}</p>
        </Card>
        <Card className="p-3">
          <p className="text-[10px] font-medium uppercase text-slate-500">Destaque</p>
          <p className="mt-1 text-xl font-bold text-slate-900">
            {kpi.melhorAteAqui ? "Recorde" : "Abaixo do pico"}
          </p>
          <p className="mt-0.5 text-[10px] text-slate-500">
            {kpi.zScore != null
              ? `z-score vs anteriores: ${kpi.zScore > 0 ? "+" : ""}${kpi.zScore}`
              : "z-score com 4+ execuções"}
          </p>
        </Card>
      </div>
    </div>
  );
}
