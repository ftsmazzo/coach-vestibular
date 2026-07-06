import Link from "next/link";
import type { JourneyInsight, TendenciaJornada } from "@/lib/journey-insight";
import { JornadaElegibilidadeCard } from "@/components/jornada-elegibilidade-card";
import { Badge, Card, LinkButton } from "@/components/ui";

function tomTendencia(t: TendenciaJornada) {
  switch (t) {
    case "subindo":
      return "success" as const;
    case "cuidado":
      return "warning" as const;
    case "inicio":
      return "neutral" as const;
    default:
      return "neutral" as const;
  }
}

export function DashboardHomeCopiloto({ insight }: { insight: JourneyInsight }) {
  if (!insight.temDados) {
    return (
      <JornadaElegibilidadeCard
        elegibilidade={insight.elegibilidade}
        jornadaIniciada={insight.jornadaIniciada}
        temRegistrosProva={insight.temRegistrosProva}
      />
    );
  }

  const {
    missao,
    estado,
    padraoCognitivo,
    principalGargalo,
    focosSecundarios,
    temDiagnosticoEscopo,
    coberturaN2,
    diagnosticoIntegrado,
    copiloto,
    alavancas,
    linhaAnamnese,
  } = insight;

  const padraoSeparado =
    padraoCognitivo &&
    !principalGargalo?.metadadosResumo &&
    padraoCognitivo.pctErrosClassificados >= 40;

  const coberturaBaixa =
    coberturaN2 && !coberturaN2.motorOperacional && coberturaN2.totalErros >= 3;

  return (
    <div className="space-y-5 sm:space-y-6">
      {missao && (
        <Card className="border-teal-200 bg-gradient-to-br from-teal-50 to-white p-5 sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-800">
            Missão da semana
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{missao.focoTitulo}</h2>
          {missao.impactoEstimado && (
            <p className="mt-2 text-sm font-medium text-teal-800">{missao.impactoEstimado}</p>
          )}
          <p className="mt-3 rounded-lg border border-teal-100 bg-white/80 px-3 py-2.5 text-sm font-medium leading-relaxed text-slate-800">
            {missao.focoDescricao}
          </p>
          <p className="mt-2 text-xs text-slate-500">
            Passo prático da semana — vale mais que reler tudo de uma matéria.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <LinkButton href="/quests#agora">O que fazer agora</LinkButton>
            <LinkButton href="/plano" variant="secondary">
              Ver plano completo
            </LinkButton>
          </div>
          {missao.questsPendentes.length > 0 && (
            <p className="mt-4 border-t border-teal-100 pt-3 text-sm text-slate-600">
              {missao.questsPendentes.length === 1
                ? "1 passo prático"
                : `${missao.questsPendentes.length} passos práticos`}{" "}
              na lista — o diagnóstico fica aqui; o como fazer está em passo a passo em Quests.
            </p>
          )}
        </Card>
      )}

      {principalGargalo && (
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50/90 to-white p-4 sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900">
            Por que isso importa para sua nota
          </p>
          {diagnosticoIntegrado && (
            <h3 className="mt-1 text-base font-bold text-slate-900">{diagnosticoIntegrado.titulo}</h3>
          )}
          {copiloto ? (
            <div className="mt-3 space-y-3 text-sm leading-relaxed text-slate-800">
              <p>{copiloto.camadas.oQueAcontece}</p>
              <p>{copiloto.camadas.comoCognitivo}</p>
              <p className="text-slate-700">{copiloto.camadas.quandoAparece}</p>
              <p className="rounded-md border border-amber-100/80 bg-white/60 px-3 py-2 text-slate-700">
                {copiloto.camadas.naoSignifica}
              </p>
              <p className="font-medium text-amber-950">{copiloto.camadas.caminho}</p>
            </div>
          ) : (
            <p className="mt-3 text-sm leading-relaxed text-slate-800">{principalGargalo.descricao}</p>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            {principalGargalo.materiaDeficitPrincipal && (
              <Badge tone="danger">
                Onde mais dá para subir: {principalGargalo.materiaDeficitPrincipal}
              </Badge>
            )}
            {principalGargalo.pctAcertoEscopo != null && (
              <Badge tone="warning">
                {principalGargalo.escopoLabel}: {principalGargalo.pctAcertoEscopo}% de acerto neste escopo
              </Badge>
            )}
            {principalGargalo.metadadosResumo && (
              <Badge tone="warning">Metacognição: {principalGargalo.metadadosResumo}</Badge>
            )}
          </div>

          {focosSecundarios.length > 0 && (
            <div className="mt-4 border-t border-amber-100 pt-3">
              <p className="text-[10px] font-semibold uppercase text-amber-900/80">
                Também vale atenção
              </p>
              <ul className="mt-2 space-y-2">
                {focosSecundarios.map((f) => (
                  <li key={f.escopoId} className="text-xs leading-relaxed text-slate-700">
                    {f.escopoLabel} ({f.materiaLabel}) — {f.hipoteseCausa}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <LinkButton href="/quests#agora" variant="secondary" className="mt-4">
            Ver passos na lista de tarefas
          </LinkButton>
        </Card>
      )}

      {linhaAnamnese && (
        <p className="rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2 text-sm text-violet-950">
          {linhaAnamnese}
        </p>
      )}

      {coberturaBaixa && (
        <Card className="border-dashed border-slate-200 bg-slate-50/50 p-4 text-xs text-slate-600">
          Cobertura N2: {coberturaN2!.pctCobertura}% dos erros com escopo classificado. Classifique a
          prova no admin para ativar o copiloto por escopo.
        </Card>
      )}

      {!temDiagnosticoEscopo && !coberturaBaixa && (
        <Card className="border-dashed border-slate-200 bg-slate-50/50 p-4 text-xs text-slate-600">
          Registre provas do catálogo com classificação N2 no admin para o diagnóstico por escopo.
        </Card>
      )}

      {estado && (
        <Card className="p-4 sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Estado da jornada
          </p>
          <div className="mt-3 flex flex-wrap items-start gap-4">
            <div>
              <p className="text-3xl font-bold text-slate-900">{estado.pctAcertoPonderado}%</p>
              <p className="text-xs text-slate-500">aprendizado ponderado</p>
            </div>
            <div className="flex flex-1 flex-wrap gap-2">
              <Badge tone={tomTendencia(estado.tendencia)}>{estado.tendenciaLabel}</Badge>
              {estado.recoveryMode && <Badge tone="warning">Recuperação</Badge>}
            </div>
          </div>
          <ul className="mt-4 space-y-1.5 text-sm text-slate-700">
            <li>
              <strong className="text-slate-900">Consistência:</strong> {estado.consistenciaLabel}
            </li>
            <li>
              <strong className="text-slate-900">Risco:</strong> {estado.riscoLabel}
            </li>
            <li>
              <strong className="text-slate-900">Meta:</strong> {estado.metaAlvo}
            </li>
          </ul>
        </Card>
      )}

      {padraoSeparado && (
        <Card className="border-violet-100 bg-violet-50/40 p-4 sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">
            Padrão geral de erro (toda a jornada)
          </p>
          <p className="mt-2 text-sm leading-relaxed text-violet-950">{padraoCognitivo.insight}</p>
          <Link
            href="/simulados"
            className="mt-3 inline-block text-xs font-medium text-violet-700 underline"
          >
            Classifique erros nos registros →
          </Link>
        </Card>
      )}

      {alavancas.length > 0 && (
        <details className="rounded-xl border border-slate-200 bg-slate-50/40">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700">
            Contexto por matéria (organização curricular)
          </summary>
          <div className="space-y-2 border-t border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">
              Visão por matéria — o foco da semana acima usa o escopo N2 que mais se repete nos seus
              erros.
            </p>
            {alavancas.slice(0, 4).map((a) => (
              <div
                key={a.materiaId}
                className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs"
              >
                <span className="font-medium text-slate-800">{a.label}</span>
                <span className="text-slate-500"> · {a.pctAcerto}% na jornada</span>
                {a.potencial === "alto" && (
                  <span className="ml-1 text-teal-700">· alto impacto</span>
                )}
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}
