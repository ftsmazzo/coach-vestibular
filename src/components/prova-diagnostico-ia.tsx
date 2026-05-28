import { Card, Badge } from "@/components/ui";
import type { CopilotoNarrativa } from "@/lib/copiloto-ia-types";

export function ProvaDiagnosticoIA({
  narrativa,
  provaNome,
}: {
  narrativa: CopilotoNarrativa;
  provaNome: string;
}) {
  const c = narrativa.camadas;

  return (
    <div className="space-y-4">
      <Card className="border-teal-200 bg-gradient-to-br from-teal-50 to-white p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-800">
            Diagnóstico desta prova
          </p>
          <Badge tone="success">IA</Badge>
        </div>
        <h2 className="mt-1 text-lg font-bold text-slate-900 sm:text-xl">
          {narrativa.missaoTitulo}
        </h2>
        {narrativa.missaoImpacto && (
          <p className="mt-2 text-sm font-medium text-teal-800">{narrativa.missaoImpacto}</p>
        )}
        <p className="mt-3 rounded-lg border border-teal-100 bg-white/80 px-3 py-2.5 text-sm leading-relaxed text-slate-800">
          {narrativa.missaoDescricao}
        </p>
        <p className="mt-2 text-[11px] text-slate-500">
          Específico de {provaNome} — não se mistura com o plano da jornada.
        </p>
      </Card>

      {c && (
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50/90 to-white p-4 sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900">
            Por que isso acontece nesta prova
          </p>
          {narrativa.diagnosticoTitulo && (
            <h3 className="mt-1 text-base font-bold text-slate-900">
              {narrativa.diagnosticoTitulo}
            </h3>
          )}
          <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-800">
            {c.oQueAcontece && <p>{c.oQueAcontece}</p>}
            {c.comoCognitivo && <p>{c.comoCognitivo}</p>}
            {c.quandoAparece && <p className="text-slate-700">{c.quandoAparece}</p>}
            {c.naoSignifica && (
              <p className="rounded-md border border-amber-100/80 bg-white/60 px-3 py-2 text-slate-700">
                {c.naoSignifica}
              </p>
            )}
            {c.caminho && <p className="font-medium text-amber-950">{c.caminho}</p>}
          </div>
        </Card>
      )}
    </div>
  );
}
