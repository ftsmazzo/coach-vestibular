import type { KpiExecucao } from "@/lib/kpi-evolucao";
import { formatarDelta, labelPercentil } from "@/lib/kpi-evolucao";
import { Card } from "@/components/ui";

export interface AreaDestaqueKpi {
  label: string;
  pct: number;
}

export function KpiResumoTres({
  kpi,
  areaDestaque,
  contexto = "vestibulares oficiais",
}: {
  kpi: KpiExecucao | null;
  areaDestaque?: AreaDestaqueKpi | null;
  contexto?: string;
}) {
  if (!kpi) {
    return (
      <p className="text-sm text-slate-500">
        Registre vestibulares oficiais para ver evolução vs seu histórico.
      </p>
    );
  }

  const deltaTone =
    kpi.deltaVsMedia == null
      ? "text-slate-700"
      : kpi.deltaVsMedia > 0
        ? "text-emerald-700"
        : kpi.deltaVsMedia < 0
          ? "text-rose-700"
          : "text-slate-700";

  const tendenciaTone =
    kpi.tendenciaSerie === "subindo"
      ? "text-emerald-700"
      : kpi.tendenciaSerie === "caindo"
        ? "text-rose-700"
      : "text-slate-800";

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <Card className="p-4">
        <p className="text-xs text-slate-500">vs sua média anterior</p>
        {kpi.deltaVsMedia != null ? (
          <>
            <p className={`mt-1 text-3xl font-bold ${deltaTone}`}>
              {formatarDelta(kpi.deltaVsMedia)}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              Último: <strong>{kpi.pct}%</strong>
              <span className="text-slate-400"> · </span>
              média antes: {kpi.mediaAnteriores}%
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-3xl font-bold text-slate-800">{kpi.pct}%</p>
            <p className="mt-1 text-xs text-slate-500">
              Primeiro {contexto} — a média aparece a partir do 2º registro.
            </p>
          </>
        )}
      </Card>

      <Card className="p-4">
        <p className="text-xs text-slate-500">Tendência da série</p>
        {kpi.inclinacaoSerie != null && kpi.totalAteAqui >= 2 ? (
          <>
            <p className={`mt-1 text-3xl font-bold ${tendenciaTone}`}>
              {kpi.tendenciaSerie === "subindo"
                ? "Em alta"
                : kpi.tendenciaSerie === "caindo"
                  ? "Em queda"
                  : "Estável"}
            </p>
            <p className="mt-1 text-sm text-slate-700">
              ~{kpi.inclinacaoSerie > 0 ? "+" : ""}
              {kpi.inclinacaoSerie} p.p. por execução ({kpi.totalAteAqui} no histórico)
            </p>
          </>
        ) : (
          <>
            <p className="mt-1 text-2xl font-bold text-slate-400">—</p>
            <p className="mt-1 text-xs text-slate-500">Precisa de 2+ execuções em {contexto}.</p>
          </>
        )}
      </Card>

      <Card className="p-4">
        {kpi.percentilVsAnteriores != null ? (
          <>
            <p className="text-xs text-slate-500">Percentil pessoal</p>
            <p className="mt-1 text-3xl font-bold text-slate-900">{kpi.percentilVsAnteriores}%</p>
            <p className="mt-1 text-xs leading-snug text-slate-600">
              {labelPercentil(kpi.percentilVsAnteriores)}
              {kpi.melhorAteAqui ? " · recorde até aqui" : ""}
            </p>
          </>
        ) : areaDestaque ? (
          <>
            <p className="text-xs text-slate-500">Área mais forte (jornada)</p>
            <p className="mt-1 text-3xl font-bold text-teal-800">{areaDestaque.pct}%</p>
            <p className="mt-1 text-sm text-slate-700">{areaDestaque.label}</p>
            <p className="mt-0.5 text-[10px] text-slate-500">
              Percentil aparece a partir da 2ª execução.
            </p>
          </>
        ) : (
          <>
            <p className="text-xs text-slate-500">Destaque</p>
            <p className="mt-1 text-2xl font-bold text-slate-800">
              {kpi.melhorAteAqui ? "Recorde" : `${kpi.pct}%`}
            </p>
            <p className="mt-1 text-xs text-slate-500">Sua 1ª execução nesta série.</p>
          </>
        )}
      </Card>
    </div>
  );
}
