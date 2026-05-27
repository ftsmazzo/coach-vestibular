import Link from "next/link";
import type { ResumoProvaDiagnostico, MateriaErroResumo } from "@/lib/diagnosis-prova";
import { Card, Badge } from "@/components/ui";

function BarraMateria({ m, jornada }: { m: MateriaErroResumo; jornada?: boolean }) {
  const pctErro = m.total > 0 ? Math.round((m.erros / m.total) * 100) : 0;
  return (
    <div className="rounded-xl border border-slate-100 bg-white p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-semibold text-slate-900">{m.materia}</span>
        <span className="text-sm font-medium text-rose-700">
          {m.erros} erro{m.erros > 1 ? "s" : ""}
        </span>
      </div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className="h-full rounded-full bg-gradient-to-r from-rose-400 to-rose-500 transition-all"
          style={{ width: `${Math.max(pctErro, 8)}%` }}
        />
      </div>
      <p className="mt-2 text-xs text-slate-500">
        {m.acertos} acertos de {m.total}
        {jornada
          ? " · agregado na sua jornada"
          : ` · questões erradas: nº ${m.numerosErrados.slice(0, 12).join(", ")}${m.numerosErrados.length > 12 ? ` +${m.numerosErrados.length - 12}` : ""}`}
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
  /** No dashboard: menos assuntos, link para o plano */
  compact?: boolean;
  /** Dados agregados de todos os registros (não uma prova só) */
  escopoJornada?: boolean;
}) {
  const assuntos = compact ? resumo.assuntosPrioritarios.slice(0, 3) : resumo.assuntosPrioritarios;
  const restantes = resumo.assuntosPrioritarios.length - assuntos.length;

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
            {resumo.materiasComMaisErros[0]?.materia ?? "—"}
          </p>
          <p className="text-sm text-teal-800">
            {resumo.materiasComMaisErros[0]
              ? `maior taxa de erro (${resumo.materiasComMaisErros[0].erros} questões)`
              : "Registre mais questões"}
          </p>
        </div>
      </div>

      {resumo.materiasComMaisErros.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-800">
            Matérias que mais precisam de atenção
          </h3>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {resumo.materiasComMaisErros.map((m) => (
              <BarraMateria key={m.materia} m={m} jornada={escopoJornada} />
            ))}
          </div>
        </div>
      )}

      {assuntos.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-semibold text-slate-800">
            Assuntos que entram no seu plano
          </h3>
          <ul className="mt-3 space-y-3">
            {assuntos.map((a, i) => (
              <li
                key={`${a.materia}-${a.assunto}`}
                className="flex gap-3 rounded-xl border border-slate-100 bg-slate-50/50 p-3"
              >
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">
                    {a.materia} — {a.assunto}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    {escopoJornada
                      ? `${a.erros} erro${a.erros > 1 ? "s" : ""} na jornada`
                      : `Questões erradas: nº ${a.numerosErrados.slice(0, 8).join(", ")}${a.numerosErrados.length > 8 ? "…" : ""}`}
                    {a.nivelDificuldade && (
                      <span className="ml-2">
                        <Badge tone={a.erros >= 2 ? "danger" : "warning"}>
                          {a.nivelDificuldade}
                        </Badge>
                      </span>
                    )}
                  </p>
                  {a.conhecimentoExigido && !compact && (
                    <p className="mt-1 text-xs text-slate-500">{a.conhecimentoExigido}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
          {compact && restantes > 0 && (
            <p className="mt-2 text-sm text-slate-500">
              +{restantes} assunto{restantes > 1 ? "s" : ""} no{" "}
              <Link href="/plano" className="text-teal-700 underline">
                plano semanal
              </Link>
              .
            </p>
          )}
        </div>
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
