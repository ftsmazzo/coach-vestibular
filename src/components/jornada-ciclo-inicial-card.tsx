import type { CicloInicialResumo } from "@/lib/jornada-ciclo-inicial";
import { Card, LinkButton } from "@/components/ui";

function formatarData(iso: string): string {
  return new Date(iso).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "short",
  });
}

type Props = {
  ciclo: CicloInicialResumo;
};

export function JornadaCicloInicialCard({ ciclo }: Props) {
  const { narrativa, baseline } = ciclo;
  const ev = baseline.evidencias;

  return (
    <Card className="border-indigo-200 bg-gradient-to-br from-indigo-50/90 via-white to-violet-50/40 p-5 sm:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-indigo-800">
        Semana {ciclo.indice} · ciclo ativo
      </p>
      <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{narrativa.titulo}</h2>
      <p className="mt-1 text-sm text-slate-600">{narrativa.subtitulo}</p>
      <p className="mt-1 text-xs text-slate-500">
        {formatarData(ciclo.startAt)} — {formatarData(ciclo.endAt)}
      </p>

      <p className="mt-4 text-sm leading-relaxed text-slate-800">{narrativa.mensagem}</p>

      <div className="mt-4 rounded-lg border border-indigo-100 bg-white/80 px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Foco principal
        </p>
        <p className="mt-1 text-sm font-medium text-slate-900">{narrativa.focoPrincipal}</p>
        <p className="mt-2 text-xs text-slate-600">{narrativa.porqueEsseFoco}</p>
      </div>

      {ciclo.metaEscopoId && ev.totalQuestoesNoEscopo > 0 && (
        <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3 text-sm text-slate-700">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Baseline do foco
          </p>
          <p className="mt-1">
            {ev.errosNoEscopo} erro(s) em {ev.totalQuestoesNoEscopo} questões ({ev.pctErro}% de
            erro)
            {ev.provasComErro >= 2
              ? ` · em ${ev.provasComErro} provas da Jornada`
              : ""}
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Contagem agregada somando as provas consideradas na Jornada — não é o total de uma única
            prova.
          </p>
          <p className="mt-2 text-xs text-slate-600">{baseline.leitura.hipoteseDiagnostica}</p>
        </div>
      )}

      <p className="mt-4 rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2.5 text-sm text-violet-950">
        {narrativa.limiteDaSemana}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <LinkButton href="/provas" variant="secondary">
          Ver relatórios de prova
        </LinkButton>
      </div>
    </Card>
  );
}
