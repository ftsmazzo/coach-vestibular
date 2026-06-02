import { Card, Badge } from "@/components/ui";
import type { CicloFechadoView } from "@/lib/ciclo";

export function CicloResultadoCard({ ciclo }: { ciclo: CicloFechadoView }) {
  const temQuiz = ciclo.quizPct != null;
  const delta = ciclo.deltaPct;
  const tomDelta =
    delta == null ? "neutral" : delta > 0 ? "success" : delta < 0 ? "warning" : "neutral";
  const deltaLabel =
    delta == null
      ? "sem comparativo"
      : delta > 0
        ? `+${delta} pts`
        : `${delta} pts`;

  return (
    <Card className="border-violet-200 bg-gradient-to-br from-violet-50 to-white">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">
        Resultado do ciclo {ciclo.indice}
      </p>
      <h3 className="mt-0.5 text-base font-bold text-slate-900">{ciclo.metaTitulo}</h3>

      <div className="mt-3 flex flex-wrap items-center gap-3">
        {temQuiz ? (
          <>
            <div>
              <p className="text-2xl font-bold text-slate-900">{ciclo.quizPct}%</p>
              <p className="text-xs text-slate-500">mini-quiz do foco</p>
            </div>
            {ciclo.baselinePct != null && (
              <div className="text-xs text-slate-500">
                início: {ciclo.baselinePct}%
              </div>
            )}
            <Badge tone={tomDelta}>{deltaLabel}</Badge>
          </>
        ) : (
          <p className="text-sm text-slate-600">
            Ciclo concluído. Registre uma prova/simulado para medir o avanço de verdade.
          </p>
        )}
      </div>

      <p className="mt-2 text-xs text-slate-500">
        {ciclo.feitas}/{ciclo.totalQuests} tarefas feitas neste ciclo.
        {temQuiz ? " Confirme com uma prova real quando puder." : ""}
      </p>
    </Card>
  );
}
