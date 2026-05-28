import Link from "next/link";
import type { JourneyInsight, TendenciaJornada } from "@/lib/journey-insight";
import { WIDGET_MODE_HOME } from "@/lib/widget-context";
import { abreviarNomeProva } from "@/lib/prova-label";
import { AtividadeCard } from "@/components/atividade-card";
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
      <Card className="border-dashed border-teal-200 bg-teal-50/40 p-6 text-center">
        <h2 className="text-lg font-semibold text-slate-900">Sua jornada começa aqui</h2>
        <p className="mt-2 text-sm text-slate-600">
          Registre uma atividade para receber missão da semana, padrões de erro e prioridades
          personalizadas.
        </p>
        <LinkButton href="/provas" className="mt-4">
          Ver atividades
        </LinkButton>
      </Card>
    );
  }

  const {
    missao,
    estado,
    padraoCognitivo,
    principalGargalo,
    clustersCognitivos,
    temDiagnosticoCognitivo,
    alavancas,
    lacunasConhecimento,
    atividadesRecentes,
  } = insight;

  return (
    <div className="space-y-5 sm:space-y-6">
      {/* A — Missão da semana */}
      {missao && (
        <Card className="border-teal-200 bg-gradient-to-br from-teal-50 to-white p-5 sm:p-6">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-teal-800">
            Missão da semana
          </p>
          <h2 className="mt-1 text-xl font-bold text-slate-900 sm:text-2xl">{missao.focoTitulo}</h2>
          {missao.impactoEstimado && (
            <p className="mt-2 text-sm font-medium text-teal-800">{missao.impactoEstimado}</p>
          )}
          <p className="mt-3 text-sm leading-relaxed text-slate-700 line-clamp-4">
            {missao.focoDescricao}
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <LinkButton href="/quests">Abrir quests</LinkButton>
            <LinkButton href="/plano" variant="secondary">
              Ver plano completo
            </LinkButton>
            {!missao.temPlano && (
              <LinkButton href="/provas" variant="ghost">
                Registrar atividade
              </LinkButton>
            )}
          </div>
          {missao.questsPendentes.length > 0 && (
            <ul className="mt-4 space-y-1.5 border-t border-teal-100 pt-3">
              {missao.questsPendentes.map((q, i) => (
                <li key={q.id} className="flex items-center gap-2 text-sm text-slate-700">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <span className="line-clamp-1">{q.titulo}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}

      {/* B — Diagnóstico cognitivo (eixo principal) */}
      {principalGargalo ? (
        <Card className="border-amber-200 bg-gradient-to-br from-amber-50/90 to-white p-4 sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900">
            Diagnóstico cognitivo
          </p>
          <p className="mt-2 text-sm font-semibold leading-snug text-slate-900">
            {principalGargalo.descricao}
          </p>
          {principalGargalo.exemploConhecimento && (
            <p className="mt-2 rounded-lg bg-white/80 px-3 py-2 text-xs leading-relaxed text-slate-700 ring-1 ring-amber-100">
              Ex.: «{principalGargalo.exemploConhecimento}»
            </p>
          )}
          {clustersCognitivos.length > 1 && (
            <ul className="mt-4 space-y-2 border-t border-amber-100 pt-3">
              {clustersCognitivos.slice(1, 4).map((c) => (
                <li key={c.tipo} className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-medium text-slate-800">{c.label}</span>
                  <span className="text-slate-500">
                    {c.erros} erro{c.erros !== 1 ? "s" : ""}
                    {c.materias[0] ? ` · ${c.materias[0]}` : ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <LinkButton href="/quests#alavancas" variant="secondary" className="mt-4">
            Quests para estas lacunas
          </LinkButton>
        </Card>
      ) : (
        <Card className="border-dashed border-slate-200 bg-slate-50/50 p-4">
          <p className="text-xs text-slate-600">
            Diagnóstico cognitivo aparece quando as provas do catálogo têm{" "}
            <strong>conhecimento exigido</strong> preenchido (etapa do admin). Até lá, use o contexto
            por matéria abaixo.
          </p>
        </Card>
      )}

      {temDiagnosticoCognitivo && lacunasConhecimento.length > 0 && (
        <Card className="border-amber-100/80 p-4 sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-900">
            Conhecimentos que mais falharam
          </p>
          <ul className="mt-2 space-y-2">
            {lacunasConhecimento.slice(0, 3).map((l) => (
              <li key={l.chave} className="rounded-lg border border-amber-50 bg-white px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone="neutral">{l.tipoCognitivoLabel}</Badge>
                  {l.materia && <span className="text-[10px] text-slate-500">{l.materia}</span>}
                </div>
                <p className="mt-1 text-sm text-slate-800">{l.texto}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* C — Estado da jornada (ritmo, não matéria) */}
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

      {/* D — Padrão de erro (metacognição) */}
      {padraoCognitivo && (
        <Card className="border-violet-100 bg-violet-50/40 p-4 sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-800">
            Padrão de erro
          </p>
          <p className="mt-2 text-sm leading-relaxed text-violet-950">{padraoCognitivo.insight}</p>
          {padraoCognitivo.causaDominante && (
            <p className="mt-2 text-xs text-violet-800">
              Causa mais frequente: <strong>{padraoCognitivo.causaDominante}</strong>
              {padraoCognitivo.pctErrosClassificados > 0 &&
                ` · ${padraoCognitivo.pctErrosClassificados}% dos erros classificados`}
            </p>
          )}
          <Link
            href="/simulados"
            className="mt-3 inline-block text-xs font-medium text-violet-700 underline"
          >
            Classifique erros nos registros →
          </Link>
        </Card>
      )}

      {/* E — Contexto curricular (secundário) */}
      {alavancas.length > 0 && (
        <details className="rounded-xl border border-slate-200 bg-slate-50/40">
          <summary className="cursor-pointer px-4 py-3 text-sm font-medium text-slate-700">
            Contexto por matéria (organização curricular)
          </summary>
          <div className="space-y-2 border-t border-slate-200 px-4 py-3">
            <p className="text-xs text-slate-500">
              Matéria ajuda a navegar — o diagnóstico principal está no bloco cognitivo acima.
            </p>
            {alavancas.slice(0, 3).map((a) => (
              <div
                key={a.materiaId}
                className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs"
              >
                <span className="font-medium text-slate-800">{a.label}</span>
                <span className="text-slate-500"> · {a.pctAcerto}% na jornada</span>
              </div>
            ))}
          </div>
        </details>
      )}

      {/* F — Atividades recentes */}
      {atividadesRecentes.length > 0 && (
        <div>
          <h2 className="text-base font-semibold text-slate-900">Atividades recentes</h2>
          <p className="mb-3 text-xs text-slate-500">Resumo — compare evolução dentro da mesma prova.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {atividadesRecentes.map((r) => {
              const analiseHref = `/simulados/${r.id}`;
              const dadosHref = r.provaId ? `/provas/${r.provaId}/lente` : analiseHref;
              return (
                <AtividadeCard
                  key={r.id}
                  mode={WIDGET_MODE_HOME}
                  titulo={abreviarNomeProva(r.nome, 42)}
                  subtitulo={r.dataLabel}
                  tipoAtividade={r.tipoAtividade}
                  pct={r.pct}
                  analiseHref={analiseHref}
                  dadosHref={dadosHref}
                  terceiroHref={r.provaId ? `/quests?provaId=${r.provaId}` : "/quests"}
                  terceiroLabel="Quests"
                />
              );
            })}
          </div>
          <p className="mt-2 text-center text-[10px] text-slate-400">
            <Link href="/provas" className="text-teal-700 hover:underline">
              Ver todas as atividades
            </Link>
          </p>
        </div>
      )}
    </div>
  );
}
