import type { PlanoSemanalJornadaResumo } from "@/lib/jornada-plano-semanal";
import { AVISO_LIMITE_PLANO_JORNADA } from "@/lib/jornada-plano-semanal";
import { Card, LinkButton } from "@/components/ui";
import { GerarPlanoJornadaButton } from "@/components/gerar-plano-jornada-button";

type Props = {
  plano: PlanoSemanalJornadaResumo | null;
  podeGerar: boolean;
};

const TIPO_LABEL: Record<string, string> = {
  REVISAO_ERRO: "Revisão de erro",
  CONCEITO_BASE: "Conceito base",
  TREINO_GUIADO: "Treino guiado",
  METACOGNICAO: "Metacognição",
};

export function JornadaPlanoSemanalCard({ plano, podeGerar }: Props) {
  if (!plano) {
    if (!podeGerar) return null;
    return (
      <Card className="border-teal-200 bg-gradient-to-br from-teal-50/90 via-white to-emerald-50/40 p-5 sm:p-6">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-800">
          Plano da Semana 1
        </p>
        <h2 className="mt-1 text-xl font-bold text-slate-900">Próximo passo</h2>
        <p className="mt-2 text-sm text-slate-700">
          Com o ciclo ativo e o diagnóstico inicial, gere o plano semanal com quests específicas para
          esta semana.
        </p>
        <div className="mt-4">
          <GerarPlanoJornadaButton />
        </div>
      </Card>
    );
  }

  const { narrative, items, quests } = plano;
  const limite = narrative.limiteDaInterpretacao || AVISO_LIMITE_PLANO_JORNADA;

  return (
    <Card className="border-teal-200 bg-gradient-to-br from-teal-50/90 via-white to-emerald-50/40 p-5 sm:p-6">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-800">
        Plano da Semana 1
      </p>
      <h2 className="mt-1 text-xl font-bold text-slate-900">{narrative.titulo}</h2>
      <p className="mt-2 text-sm leading-relaxed text-slate-800">{narrative.mensagem}</p>

      <div className="mt-4 rounded-lg border border-teal-100 bg-white/80 px-3 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Foco da semana
        </p>
        <p className="mt-1 text-sm font-medium text-slate-900">{narrative.focoDaSemana}</p>
        <p className="mt-2 text-xs text-slate-600">{narrative.porQueEssePlano}</p>
      </div>

      <div className="mt-4 rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-3 text-sm text-slate-700">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Carga</p>
        <p className="mt-1">
          {items.carga.questsTotal} quest{items.carga.questsTotal !== 1 ? "s" : ""} · ~
          {items.carga.duracaoTotalEstimadaMin} min · intensidade {items.carga.intensidade.toLowerCase()}
          {items.carga.moduladaPorAnamnese ? " (ajustada pela anamnese)" : ""}
        </p>
        <p className="mt-2 text-xs text-slate-600">{narrative.comoExecutar}</p>
      </div>

      {items.blocos.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Blocos</p>
          {items.blocos.map((b) => (
            <div
              key={b.ordem}
              className="rounded-lg border border-slate-100 bg-white/70 px-3 py-2 text-sm"
            >
              <p className="font-medium text-slate-900">
                {b.ordem}. {b.titulo}
              </p>
              <p className="text-xs text-slate-600">{b.objetivo}</p>
            </div>
          ))}
        </div>
      )}

      {quests.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Quests</p>
          {quests.map((q, i) => (
            <div
              key={q.id}
              className="rounded-lg border border-teal-100 bg-white/70 px-3 py-2.5 text-sm"
            >
              <p className="font-medium text-slate-900">
                {i + 1}. {q.titulo}
                <span className="ml-2 text-xs font-normal text-slate-500">
                  {TIPO_LABEL[q.tipoQuest] ?? q.tipoQuest} · ~{q.duracaoMin} min
                </span>
              </p>
              {q.motivo && (
                <p className="mt-1 text-xs text-slate-600">
                  <span className="font-medium">Por que existe:</span> {q.motivo}
                </p>
              )}
              {q.criterioConclusao && (
                <p className="mt-1 text-xs text-teal-800">
                  <span className="font-medium">Concluir quando:</span> {q.criterioConclusao}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="mt-4 rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2.5 text-sm text-violet-950">
        <span className="font-medium">Critério desta semana:</span>{" "}
        {narrative.criterioDeFechamentoLocal}
      </p>

      <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2.5 text-xs leading-relaxed text-amber-950">
        {limite}
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <LinkButton href="/quests#jornada">Ver quests da semana</LinkButton>
        <LinkButton href="/plano" variant="secondary">
          Plano completo
        </LinkButton>
      </div>
    </Card>
  );
}
