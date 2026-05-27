import Link from "next/link";
import { buildResumoJornada } from "@/lib/jornada";
import { Card, Badge, Button } from "@/components/ui";

export async function JornadaResumoCard({ userId }: { userId: string }) {
  const j = await buildResumoJornada(userId);

  if (j.totalRegistros === 0) {
    return (
      <Card className="border-dashed border-teal-200 bg-teal-50/30">
        <p className="text-sm text-slate-700">
          Sua jornada começa no primeiro registro em{" "}
          <Link href="/provas" className="font-medium text-teal-700 underline">
            Provas públicas
          </Link>
          .
        </p>
      </Card>
    );
  }

  return (
    <Card className="border-teal-200 bg-gradient-to-br from-teal-50/80 to-white">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
            Sua jornada
          </p>
          <p className="mt-1 text-2xl font-bold text-slate-900">
            {j.pctAcertoPonderado}%{" "}
            <span className="text-base font-normal text-slate-600">acerto ponderado</span>
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {j.acertos} acertos · {j.erros} erros · {j.totalRegistros} registros
          </p>
        </div>
        {j.xp > 0 && (
          <span className="inline-flex rounded-full bg-emerald-100 px-3 py-1 text-sm font-medium text-emerald-800">
            ⭐ {j.xp} XP
          </span>
        )}
      </div>

      {j.porModoUso.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {j.porModoUso.map((m) => (
            <span
              key={m.modoUso}
              className="rounded-lg bg-white/80 px-3 py-1.5 text-xs ring-1 ring-teal-100"
            >
              <strong>{m.registros}</strong>× {m.label.split("(")[0].trim()} — {m.pctAcerto}%
            </span>
          ))}
        </div>
      )}

      {j.porMateria.length > 0 && (
        <div className="mt-4">
          <p className="text-xs font-medium text-slate-600">Maior pressão de erro (ponderado)</p>
          <ul className="mt-2 flex flex-wrap gap-2">
            {j.porMateria.slice(0, 5).map((m) => (
              <Badge key={m.materiaId} tone={m.erros >= 3 ? "danger" : "warning"}>
                {m.label}: {m.erros} erro{m.erros !== 1 ? "s" : ""}
              </Badge>
            ))}
          </ul>
        </div>
      )}

      <p className="mt-4 text-xs text-slate-500">
        Oficiais pesam mais no plano; treinos e revisões de prova antiga mostram se você está
        evoluindo.
      </p>
      <Link href="/simulados" className="mt-3 inline-block">
        <Button variant="secondary" className="text-xs">
          Ver todos os registros
        </Button>
      </Link>
    </Card>
  );
}
