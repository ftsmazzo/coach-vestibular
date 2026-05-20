import type { ResumoProvaDiagnostico } from "@/lib/diagnosis-prova";
import { Card, Badge } from "@/components/ui";

export function ResumoDiagnosticoCard({
  resumo,
  checkIn,
}: {
  resumo: ResumoProvaDiagnostico;
  checkIn?: number | null;
}) {
  return (
    <Card className="border-slate-200">
      <h2 className="mb-3 font-semibold text-slate-900">Resultado desta prova</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl bg-emerald-50 px-4 py-3">
          <p className="text-xs font-medium text-emerald-800">Acertos</p>
          <p className="text-2xl font-bold text-emerald-900">
            {resumo.acertos}{" "}
            <span className="text-base font-semibold">({resumo.pctAcerto}%)</span>
          </p>
        </div>
        <div className="rounded-xl bg-rose-50 px-4 py-3">
          <p className="text-xs font-medium text-rose-800">Erros</p>
          <p className="text-2xl font-bold text-rose-900">
            {resumo.erros}{" "}
            <span className="text-base font-semibold">({resumo.pctErro}%)</span>
          </p>
        </div>
        <div className="rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-xs font-medium text-slate-600">Analisadas</p>
          <p className="text-2xl font-bold text-slate-900">{resumo.total} questões</p>
        </div>
      </div>

      {resumo.materiasComMaisErros.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-800">
            2 matérias com mais erros
          </h3>
          <ul className="mt-2 space-y-2">
            {resumo.materiasComMaisErros.map((m) => (
              <li
                key={m.materia}
                className="rounded-lg border border-rose-100 bg-rose-50/50 px-3 py-2 text-sm"
              >
                <span className="font-medium text-rose-900">{m.materia}</span>
                <span className="text-rose-800">
                  {" "}
                  — {m.erros} erro{m.erros > 1 ? "s" : ""} (questões nº{" "}
                  {m.numerosErrados.slice(0, 15).join(", ")}
                  {m.numerosErrados.length > 15
                    ? ` +${m.numerosErrados.length - 15}`
                    : ""}
                  )
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {resumo.assuntosPrioritarios.length > 0 && (
        <div className="mt-4">
          <h3 className="text-sm font-semibold text-slate-800">Assuntos para o plano</h3>
          <ul className="mt-2 space-y-2">
            {resumo.assuntosPrioritarios.map((a) => (
              <li key={`${a.materia}-${a.assunto}`} className="text-sm text-slate-700">
                <Badge tone={a.erros >= 2 ? "danger" : "warning"}>
                  {a.materia} — {a.assunto}
                </Badge>
                <p className="mt-1 text-slate-600">
                  Erros: nº {a.numerosErrados.join(", ")}
                  {a.conhecimentoExigido && (
                    <>
                      <br />
                      <span className="text-slate-500">
                        Conhecimento: {a.conhecimentoExigido}
                      </span>
                    </>
                  )}
                  {a.nivelDificuldade && (
                    <span className="text-slate-500"> · Dificuldade: {a.nivelDificuldade}</span>
                  )}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {checkIn != null && (
        <p className="mt-3 text-xs text-slate-500">
          Check-in emocional após a prova: {checkIn}/5
          {checkIn <= 2 ? " — contribuiu para plano mais leve." : "."}
        </p>
      )}
    </Card>
  );
}
