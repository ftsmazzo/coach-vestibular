import Link from "next/link";
import { Card, Badge } from "@/components/ui";
import type { CicloResumo } from "@/lib/ciclo";

export function CicloStoryCard({ ciclo }: { ciclo: CicloResumo }) {
  if (!ciclo.historiaInicio?.length) return null;

  return (
    <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/80 to-white">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-800">
            Sua história de aprendizagem · ciclo {ciclo.indice}
          </p>
          <h3 className="mt-0.5 text-base font-bold text-slate-900">{ciclo.metaTitulo}</h3>
        </div>
        {ciclo.metaEscopoId && (
          <Badge tone="neutral">Escopo N2</Badge>
        )}
      </div>

      <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700">
        {ciclo.historiaInicio.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      <p className="mt-3 text-xs text-indigo-800/80">
        {ciclo.feitas}/{ciclo.total} tarefas feitas ·{" "}
        <Link href="/quests" className="font-medium underline">
          continuar em Quests
        </Link>
      </p>
    </Card>
  );

}
