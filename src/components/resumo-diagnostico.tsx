import Link from "next/link";
import type { ResumoProvaDiagnostico, EscopoErroResumo } from "@/lib/diagnosis-prova";
import { Card, Badge } from "@/components/ui";

function BarraEscopo({ e, jornada }: { e: EscopoErroResumo; jornada?: boolean }) {
  const pctErro = e.total > 0 ? Math.round((e.erros / e.total) * 100) : 0;
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-900">{e.escopoLabel}</span>
        <span className="text-sm font-medium text-rose-700">
          {e.erros} erro{e.erros > 1 ? "s" : ""}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-500 transition-all"
          style={{ width: `${Math.max(pctErro, 8)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {e.materia} · {e.acertos} acertos de {e.total}
        {jornada
          ? " · agregado na jornada"
          : ` · questões erradas: nº ${e.numerosErrados.slice(0, 12).join(", ")}${e.numerosErrados.length > 12 ? ` +${e.numerosErrados.length - 12}` : ""}`}
      </p>
    </div>
  );
}

export function ResumoDiagnosticoCard({
  resumo,
  checkIn,
  compact = false,
  escopoJornada = false,
}: {
  resumo: ResumoProvaDiagnostico;
  checkIn?: number | null;
  compact?: boolean;
  escopoJornada?: boolean;
}) {
  const escopos = compact
    ? resumo.escoposPrioritarios.slice(0, 3)
    : resumo.escoposPrioritarios;
  const restantes = resumo.escoposPrioritarios.length - escopos.length;
  const focoPrincipal = resumo.escoposPrioritarios[0];

  return (
    <Card className="border-slate-200/80 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-semibold text-slate-900">
          {escopoJornada ? "O que sua jornada mostrou" : "O que a prova mostrou"}
        </h2>
        {compact && (
          <Link href="/plano" className="text-sm font-medium text-teal-700 hover:underline">
            Ver plano completo →
          </Link>
        )}
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-emerald-50 px-4 py-4 ring-1 ring-emerald-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Acertos
          </p>
          <p className="mt-1 text-3xl font-bold text-emerald-900">{resumo.pctAcerto}%</p>
          <p className="text-sm text-emerald-800">
            {resumo.acertos} de {resumo.total} questões
          </p>
        </div>
        <div className="rounded-xl bg-rose-50 px-4 py-4 ring-1 ring-rose-100">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-700">Erros</p>
          <p className="mt-1 text-3xl font-bold text-rose-900">{resumo.pctErro}%</p>
          <p className="text-sm text-rose-800">
            {resumo.erros} de {resumo.total} questões
          </p>
        </div>
        <div className="rounded-xl bg-teal-50 px-4 py-4 ring-1 ring-teal-100 sm:col-span-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">Foco</p>
          <p className="mt-1 text-lg font-bold leading-snug text-teal-900">
            {focoPrincipal?.escopoLabel ?? "—"}
          </p>
          <p className="text-sm text-teal-800">
            {focoPrincipal
              ? `${focoPrincipal.erros} erro(s) neste escopo`
              : "Classifique escopos N2 no admin"}
          </p>
        </div>
      </div>

      {escopos.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-800">
            Escopos que mais precisam de atenção
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {escopos.map((e) => (
              <BarraEscopo key={e.escopoId} e={e} jornada={escopoJornada} />
            ))}
          </div>
        </div>
      )}

      {escopos.length > 0 && !compact && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-800">
            Escopos que entram no seu plano
          </h3>
          <ul className="mt-3 space-y-3">
            {escopos.map((e, i) => (
              <li
                key={e.escopoId}
                className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">
                    {e.escopoLabel}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {e.materia} ·{" "}
                    {escopoJornada
                      ? `${e.erros} erro${e.erros > 1 ? "s" : ""} na jornada`
                      : `Questões erradas: nº ${e.numerosErrados.slice(0, 8).join(", ")}${e.numerosErrados.length > 8 ? "…" : ""}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {compact && restantes > 0 && (
        <p className="mt-2 text-sm text-slate-500">
          +{restantes} escopo{restantes > 1 ? "s" : ""} no{" "}
          <Link href="/plano" className="text-teal-700 underline">
            plano semanal
          </Link>
          .
        </p>
      )}

      {checkIn != null && (
        <p className="mt-4 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-600">
          Como você se sentiu após a prova: <strong>{checkIn}/5</strong>
          {checkIn <= 2 ? " — plano em ritmo mais leve." : "."}
        </p>
      )}
    </Card>
  );
}
