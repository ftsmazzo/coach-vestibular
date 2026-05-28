import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPlanoAtual } from "@/lib/plano-atual";
import { buildResumoJornada } from "@/lib/jornada";
import { RecalcularDiagnosticoButton } from "@/components/recalcular-diagnostico-button";
import { RegenerarPlanoButton } from "@/components/regenerar-plano-button";
import { PanoramaJornadaLive } from "@/components/panorama-jornada-live";
import { Card, Badge, LinkButton } from "@/components/ui";
import type { StudyPlanItem } from "@/lib/study-plan";

function isPlanoCopiloto(items: StudyPlanItem[]): boolean {
  return items.some(
    (i) =>
      i.titulo === "Sua semana na jornada" ||
      (i.bloco === "foco_profundo" && i.descricao.includes("O que fazer"))
  );
}

function CardBlocoPlano({ item }: { item: StudyPlanItem }) {
  const prioridade =
    item.bloco === "foco_profundo"
      ? "alta"
      : item.bloco === "consolidacao"
        ? "media"
        : item.bloco === "manutencao"
          ? "manter"
          : null;

  return (
    <Card
      className={
        item.bloco === "foco_profundo"
          ? "border-teal-200 bg-teal-50/30"
          : "border-slate-200"
      }
    >
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold text-slate-900">{item.titulo}</h3>
        {prioridade === "alta" && <Badge tone="danger">Prioridade</Badge>}
        {prioridade === "media" && <Badge tone="warning">Também importante</Badge>}
        {prioridade === "manter" && <Badge tone="success">Manutenção</Badge>}
        {item.duracaoMin > 0 && (
          <span className="text-xs text-slate-500">~{item.duracaoMin} min</span>
        )}
      </div>
      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
        {item.descricao}
      </p>
    </Card>
  );
}

function CardAnaliseMateria({ item }: { item: StudyPlanItem }) {
  const prioridade =
    item.errosNaMateria != null && item.errosNaMateria >= 3
      ? "alta"
      : item.errosNaMateria != null && item.errosNaMateria > 0
        ? "media"
        : "manter";

  return (
    <Card className="border-slate-200">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <h3 className="text-lg font-semibold text-slate-900">{item.titulo}</h3>
        {prioridade === "alta" && <Badge tone="danger">Prioridade alta</Badge>}
        {prioridade === "media" && <Badge tone="warning">Atenção</Badge>}
        {prioridade === "manter" && <Badge tone="success">Manter</Badge>}
        {item.errosNaMateria != null && item.errosNaMateria > 0 && (
          <span className="text-xs text-slate-500">
            {item.errosNaMateria} erro{item.errosNaMateria > 1 ? "s" : ""}{" "}
            {item.errosContexto === "prova" ? "na prova" : "na jornada"}
          </span>
        )}
      </div>
      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
        {item.descricao}
      </p>
    </Card>
  );
}

export default async function PlanoPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [{ plan, items }, jornada] = await Promise.all([
    getPlanoAtual(session.userId),
    buildResumoJornada(session.userId),
  ]);

  const copiloto = isPlanoCopiloto(items);
  const diagnostico = items.filter((i) => i.bloco === "diagnostico");
  const contexto = items.filter((i) => i.bloco === "contexto" || i.bloco === "meta");
  const prioridades = items.filter(
    (i) => i.bloco === "foco_profundo" || i.bloco === "consolidacao"
  );
  const manutencao = items.filter((i) => i.bloco === "manutencao");
  const analises = items.filter((i) => i.bloco === "analise_materia");
  const questsCount = items.filter(
    (i) => i.geraQuest !== false && i.duracaoMin > 0
  ).length;
  const horasQuests = Math.round(
    items
      .filter((i) => i.geraQuest !== false && i.duracaoMin > 0)
      .reduce((s, i) => s + i.duracaoMin, 0) / 60
  );

  const formatoReconhecido = copiloto || diagnostico.length > 0 || analises.length > 0;
  const planoLegado = Boolean(plan) && !formatoReconhecido;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-xl font-bold text-slate-900 sm:text-2xl">Plano desta semana</h1>
        <p className="text-sm text-slate-600 sm:text-base">
          {copiloto ? (
            <>
              Montado pelo <strong>copiloto</strong> com base em{" "}
              <strong>toda a sua jornada</strong>
              {jornada.totalRegistros > 0 && (
                <>
                  {" "}
                  ({jornada.totalRegistros} registro{jornada.totalRegistros !== 1 ? "s" : ""},{" "}
                  {jornada.pctAcertoPonderado}% acerto ponderado)
                </>
              )}
              — não é revisão só da última prova. As tarefas práticas estão em{" "}
              <Link href="/quests#agora" className="font-medium text-teal-700 hover:underline">
                O que fazer agora
              </Link>
              .
            </>
          ) : (
            <>
              Leia o diagnóstico aqui. As atividades práticas ficam em{" "}
              <Link href="/quests#agora" className="font-medium text-teal-700 hover:underline">
                O que fazer agora
              </Link>
              .
            </>
          )}
        </p>
        {plan && (
          <div className="mt-3 space-y-2">
            <p className="text-xs text-slate-500">
              Última geração do plano:{" "}
              <strong className="text-slate-700">
                {plan.createdAt.toLocaleString("pt-BR", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </strong>
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <RegenerarPlanoButton />
              <span className="text-xs text-slate-500">
                Apaga plano/quests antigos e recria com dados atuais (anamnese + provas).
              </span>
            </div>
          </div>
        )}
        {plan && horasQuests > 0 && (
          <p className="mt-1 text-sm text-teal-800">
            Carga sugerida nas atividades: ~{horasQuests}h ({questsCount} tarefa
            {questsCount !== 1 ? "s" : ""}) —{" "}
            {plan.recoveryMode ? "ritmo leve" : "ritmo normal"}.
          </p>
        )}
      </div>

      {plan?.recoveryMode && (
        <Card className="border-amber-200 bg-amber-50">
          <Badge tone="warning">Modo recuperação</Badge>
          <p className="mt-2 text-sm text-amber-900">
            Plano mais leve — priorize qualidade e descanso, sem culpa.
          </p>
        </Card>
      )}

      {!plan ? (
        <Card>
          <p className="text-slate-600">
            Registre um resultado em Atividades para gerar seu plano automaticamente.
          </p>
        </Card>
      ) : planoLegado ? (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">
            Este plano está em formato antigo. Clique em &quot;Atualizar plano pela jornada&quot;
            acima para gerar o plano do copiloto (passos claros, sem lista de números de questão).
          </p>
        </Card>
      ) : (
        <>
          {diagnostico.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">
                Diagnóstico do desempenho
              </h2>
              {diagnostico.map((item) => (
                <Card key={item.ordem} className="border-teal-100 bg-teal-50/30">
                  <p className="whitespace-pre-line text-sm leading-relaxed text-slate-800">
                    {item.descricao}
                  </p>
                </Card>
              ))}
            </section>
          )}

          {contexto.map((item) => (
            <Card key={item.ordem} className="border-slate-200 bg-slate-50/50">
              <h3 className="font-semibold text-slate-900">{item.titulo}</h3>
              {item.titulo === "Panorama da sua jornada" ? (
                <PanoramaJornadaLive userId={session.userId} />
              ) : (
                <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                  {item.descricao}
                </p>
              )}
            </Card>
          ))}

          {copiloto && prioridades.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Prioridades da semana
              </h2>
              <p className="text-sm text-slate-600">
                O <strong>porquê</strong> e o contexto ficam aqui. Os <strong>passos práticos</strong>{" "}
                (o que fazer, na ordem) estão em{" "}
                <Link href="/quests#agora" className="font-medium text-teal-700 hover:underline">
                  Quests → O que fazer agora
                </Link>
                — igual na Home.
              </p>
              <div className="space-y-3">
                {prioridades.map((item) => (
                  <CardBlocoPlano key={`${item.ordem}-${item.titulo}`} item={item} />
                ))}
              </div>
            </section>
          )}

          {copiloto && manutencao.length > 0 && (
            <section className="space-y-3">
              <h2 className="text-lg font-semibold text-slate-900">Manter ritmo</h2>
              {manutencao.map((item) => (
                <CardBlocoPlano key={`${item.ordem}-${item.titulo}`} item={item} />
              ))}
            </section>
          )}

          {analises.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Análise por matéria
              </h2>
              <p className="text-sm text-slate-600">
                Visão por matéria — as tarefas práticas estão em Quests.
              </p>
              <div className="space-y-3">
                {analises.map((item) => (
                  <CardAnaliseMateria key={`${item.ordem}-${item.titulo}`} item={item} />
                ))}
              </div>
            </section>
          )}

          <Card className="border-teal-200 bg-teal-50/40">
            <h3 className="font-semibold text-teal-900">Próximo passo</h3>
            <p className="mt-2 text-sm text-teal-900">
              Abra a lista com passo a passo — comece pelo item 1 e marque Concluir ao terminar cada
              bloco.
            </p>
            <LinkButton href="/quests#agora" className="mt-4 w-full sm:w-auto">
              O que fazer agora
            </LinkButton>
          </Card>
        </>
      )}
    </div>
  );
}
