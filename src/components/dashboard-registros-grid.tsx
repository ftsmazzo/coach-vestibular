import Link from "next/link";
import type { RegistroDashboardCard } from "@/lib/jornada-analytics";
import { labelMarcadorAtividade } from "@/lib/prova-tipo";
import { PctDonut } from "@/components/pct-donut";

export function DashboardRegistrosGrid({ registros }: { registros: RegistroDashboardCard[] }) {
  if (registros.length === 0) return null;

  return (
    <div>
      <h2 className="mb-1 text-base font-semibold text-slate-900">Últimas Atividades</h2>
      <p className="mb-3 text-xs text-slate-500">
        Cada aplicação na sua jornada — oficiais e treinos.
      </p>
      <div className="flex gap-2.5 overflow-x-auto pb-2">
        {registros.map((r) => (
          <Link
            key={r.id}
            href={r.provaId ? `/provas/${r.provaId}/lente` : `/simulados/${r.id}`}
            className="flex w-[172px] shrink-0 flex-col gap-2 overflow-hidden rounded-xl bg-gradient-to-br from-teal-600 to-teal-800 p-3 text-white shadow-md transition hover:scale-[1.01]"
          >
            <div className="flex items-start gap-2">
              <PctDonut pct={r.pct} size="sm" />
              <div className="min-w-0 flex-1">
                <span className="inline-block rounded-full bg-white/20 px-1.5 py-0.5 text-[10px] font-medium leading-none">
                  {labelMarcadorAtividade(r.categoria)}
                </span>
                <p className="mt-1.5 line-clamp-2 text-[11px] font-semibold leading-snug">{r.nome}</p>
                <p className="mt-0.5 text-[10px] text-teal-100">{r.dataLabel}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
