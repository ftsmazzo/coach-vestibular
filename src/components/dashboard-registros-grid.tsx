import Link from "next/link";
import type { RegistroDashboardCard } from "@/lib/jornada-analytics";
import { labelModoUso } from "@/lib/modo-uso";
import { PctDonut } from "@/components/pct-donut";

export function DashboardRegistrosGrid({ registros }: { registros: RegistroDashboardCard[] }) {
  if (registros.length === 0) return null;

  return (
    <div>
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Seus registros recentes</h2>
      <p className="mb-4 text-xs text-slate-500">
        Visão de cada aplicação — não só a última. Oficiais e treinos contam na jornada.
      </p>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {registros.map((r) => (
          <Link
            key={r.id}
            href={r.provaId ? `/provas/${r.provaId}/lente` : `/simulados/${r.id}`}
            className="min-w-[200px] shrink-0 overflow-hidden rounded-xl bg-gradient-to-br from-teal-600 to-teal-800 p-4 text-white shadow-md transition hover:scale-[1.02]"
          >
            <div className="flex items-center gap-3">
              <PctDonut pct={r.pct} size="md" />
              <div className="min-w-0">
                <p className="truncate text-sm font-bold leading-tight">{r.nome}</p>
                <p className="text-xs text-teal-100">{r.dataLabel}</p>
                <p className="mt-1 text-[10px] text-teal-200/90">
                  {labelModoUso(r.modoUso).split("(")[0].trim()}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
