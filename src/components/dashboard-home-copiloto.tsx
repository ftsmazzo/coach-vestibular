import Link from "next/link";
import type { IncidenciaJornada, JourneyInsight, TendenciaJornada } from "@/lib/journey-insight";
import { WIDGET_MODE_HOME } from "@/lib/widget-context";
import { abreviarNomeProva } from "@/lib/prova-label";
import { AtividadeCard } from "@/components/atividade-card";
import { Badge, Button, Card, LinkButton } from "@/components/ui";

function labelIncidencia(i: IncidenciaJornada): string {
  if (i === "alta") return "Muito presente";
  if (i === "media") return "Moderada";
  return "Baixa";
}

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

  const { missao, estado, padraoCognitivo, alavancas, atividadesRecentes } = insight;

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

      {/* B — Estado da jornada */}
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
            {insight.principalGargalo && (
              <li>
                <strong className="text-slate-900">Gargalo:</strong> {insight.principalGargalo.label}{" "}
                ({insight.principalGargalo.pctAcerto}%)
              </li>
            )}
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

      {/* C — Padrão cognitivo */}
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

      {/* D — Ganhos rápidos */}
      {alavancas.length > 0 && (
        <Card className="p-4 sm:p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            Ganhos mais rápidos
          </p>
          <p className="mt-1 text-xs text-slate-500">
            Onde corrigir tende a liberar mais nota — com base na sua jornada (não compara provas
            diferentes).
          </p>
          <ul className="mt-3 space-y-2">
            {alavancas.map((a) => (
              <li
                key={a.materiaId}
                className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-slate-900">{a.label}</span>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs text-slate-500">{a.pctAcerto}% hoje</span>
                    <Badge tone="neutral">{labelIncidencia(a.incidencia)}</Badge>
                    <Badge tone={a.potencial === "alto" ? "success" : "neutral"}>
                      {a.potencial === "alto" ? "Alto impacto" : "Médio"}
                    </Badge>
                  </div>
                </div>
                <p className="mt-1 text-xs text-slate-600">{a.mensagem}</p>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/* E — Atividades recentes */}
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
