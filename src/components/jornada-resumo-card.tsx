import Link from "next/link";
import { buildResumoJornada } from "@/lib/jornada";
import { Card, Badge } from "@/components/ui";

export async function JornadaResumoCard({ userId }: { userId: string }) {
  const j = await buildResumoJornada(userId);

  if (j.totalRegistros === 0) {
    return (
      <Card className="border-dashed border-teal-200 bg-teal-50/30 p-4">
        <p className="text-xs text-slate-700">
          Comece em{" "}
          <Link href="/provas" className="font-medium text-teal-700 underline">
            Atividades
          </Link>
          .
        </p>
      </Card>
    );
  }

  return (
    <Card className="border-teal-200 bg-gradient-to-br from-teal-50/80 to-white p-4 sm:p-5">
      <div className="grid gap-4 sm:grid-cols-[auto_1fr] sm:items-start">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-800">
            Sua jornada
          </p>
          <p className="mt-0.5 text-2xl font-bold leading-none text-slate-900">
            {j.pctAcertoPonderado}%
          </p>
          <p className="text-[10px] text-slate-500">acerto ponderado</p>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center text-[11px] sm:text-left sm:grid-cols-3 sm:gap-3">
          <div className="rounded-lg bg-white/90 px-2 py-1.5 ring-1 ring-teal-100">
            <p className="font-bold text-slate-900">{j.acertos}</p>
            <p className="text-slate-500">acertos</p>
          </div>
          <div className="rounded-lg bg-white/90 px-2 py-1.5 ring-1 ring-teal-100">
            <p className="font-bold text-rose-700">{j.erros}</p>
            <p className="text-slate-500">erros</p>
          </div>
          <div className="rounded-lg bg-white/90 px-2 py-1.5 ring-1 ring-teal-100">
            <p className="font-bold text-slate-900">{j.totalRegistros}</p>
            <p className="text-slate-500">registros</p>
          </div>
        </div>
      </div>

      {j.porModoUso.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 border-t border-teal-100 pt-3">
          {j.porModoUso.map((m) => (
            <span
              key={m.modoUso}
              className="rounded-md bg-white px-2 py-1 text-[10px] text-slate-700 ring-1 ring-teal-100"
            >
              <strong>{m.registros}×</strong> {m.label.split("(")[0].trim()}{" "}
              <span className="text-teal-800">{m.pctAcerto}%</span>
            </span>
          ))}
        </div>
      )}

      {j.porMateria.length > 0 && (
        <div className="mt-3 border-t border-teal-100 pt-3">
          <p className="text-[10px] font-medium text-slate-600">Pressão de erro (ponderado)</p>
          <ul className="mt-1.5 flex flex-wrap gap-1.5">
            {j.porMateria.slice(0, 5).map((m) => (
              <Badge key={m.materiaId} tone={m.erros >= 3 ? "danger" : "warning"}>
                {m.label}: {m.erros}
              </Badge>
            ))}
          </ul>
        </div>
      )}

      {(j.metaAlvo || j.xp > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-teal-100 pt-3 text-[10px] text-slate-600">
          {j.xp > 0 && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 font-medium text-emerald-800">
              {j.xp} XP
            </span>
          )}
          {j.metaAlvo && (
            <span>
              Meta: <strong className="text-teal-900">{j.metaAlvo}</strong>
              {j.bancasPrioritarias.length > 0 && (
                <> · {j.bancasPrioritarias.join(", ")}</>
              )}
            </span>
          )}
          <Link href="/perfil" className="text-teal-700 underline">
            Perfil
          </Link>
          <span className="text-slate-300">·</span>
          <Link href="/simulados" className="text-teal-700 underline">
            Registros
          </Link>
        </div>
      )}
    </Card>
  );
}
