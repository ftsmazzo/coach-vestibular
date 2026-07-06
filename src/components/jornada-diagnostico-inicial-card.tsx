import type { DiagnosticoInicialResumo } from "@/lib/jornada-diagnostico-inicial";
import { Card, LinkButton } from "@/components/ui";

type Props = {
  diagnostico: DiagnosticoInicialResumo;
};

export function JornadaDiagnosticoInicialCard({ diagnostico }: Props) {
  const { narrativa, evidencias, diagnostico: diag } = diagnostico;
  const prioridades = diag.prioridadesIniciais.slice(0, 3);

  return (
    <Card className="border-teal-200 bg-gradient-to-br from-teal-50 via-white to-indigo-50/30 p-5 sm:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-800">
        Marco zero da Jornada
      </p>
      <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{narrativa.titulo}</h2>
      <p className="mt-1 text-sm text-slate-600">{narrativa.subtitulo}</p>
      <p className="mt-4 text-sm leading-relaxed text-slate-800">{narrativa.mensagemPrincipal}</p>

      <div className="mt-5 rounded-lg border border-teal-100 bg-white/80 px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Evidências consideradas
        </p>
        <p className="mt-1 text-sm text-slate-700">
          {evidencias.totais.provasValidas} prova(s) · {evidencias.totais.questoesValidas} questões ·{" "}
          {evidencias.totais.pctAcerto}% de acerto · {evidencias.totais.errosAnalisaveis} erros
          analisáveis
        </p>
        {evidencias.provasConsideradas.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-slate-600">
            {evidencias.provasConsideradas.slice(0, 4).map((p) => (
              <li key={p.examId}>
                {p.nome} — {p.acertos}/{p.totalQuestoes} ({p.modoUso})
              </li>
            ))}
          </ul>
        )}
      </div>

      {prioridades.length > 0 && (
        <div className="mt-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-800">
            Prioridades iniciais
          </p>
          <ol className="mt-2 space-y-2">
            {prioridades.map((p) => (
              <li
                key={`${p.ordem}-${p.escopoId ?? p.titulo}`}
                className="rounded-lg border border-indigo-100 bg-white/70 px-3 py-2.5"
              >
                <p className="text-sm font-medium text-slate-900">
                  {p.ordem}. {p.titulo}
                </p>
                <p className="mt-0.5 text-xs text-slate-600">{p.motivo}</p>
              </li>
            ))}
          </ol>
        </div>
      )}

      {narrativa.cards.length > 0 && (
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {narrativa.cards.map((c, i) => (
            <div
              key={`${c.tipo}-${i}`}
              className={`rounded-lg border px-3 py-2.5 text-sm ${
                c.tipo === "forca"
                  ? "border-emerald-100 bg-emerald-50/60"
                  : c.tipo === "fragilidade"
                    ? "border-amber-100 bg-amber-50/60"
                    : "border-slate-100 bg-slate-50/60"
              }`}
            >
              <p className="font-medium text-slate-900">{c.titulo}</p>
              <p className="mt-1 text-xs leading-relaxed text-slate-700">{c.texto}</p>
            </div>
          ))}
        </div>
      )}

      <p className="mt-5 rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2.5 text-sm text-amber-950">
        {narrativa.avisoLimite}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <LinkButton href="/provas" variant="secondary">
          Ver relatórios de prova
        </LinkButton>
      </div>
    </Card>
  );
}
