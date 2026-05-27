import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPlanoAtual } from "@/lib/plano-atual";
import { prisma } from "@/lib/prisma";
import { RecalcularDiagnosticoButton } from "@/components/recalcular-diagnostico-button";
import { Card, Badge, LinkButton } from "@/components/ui";
import type { StudyPlanItem } from "@/lib/study-plan";

function CardAnaliseMateria({ item }: { item: StudyPlanItem }) {
  const prioridade =
    item.errosNaMateria != null && item.errosNaMateria >= 3
      ? "alta"
      : item.errosNaMateria != null && item.errosNaMateria > 0
        ? "media"
        : "manter";

  return (
    <Card className="border-slate-200">
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <h3 className="text-lg font-semibold text-slate-900">{item.titulo}</h3>
        {prioridade === "alta" && <Badge tone="danger">Prioridade alta</Badge>}
        {prioridade === "media" && <Badge tone="warning">Atenção</Badge>}
        {prioridade === "manter" && <Badge tone="success">Manter</Badge>}
        {item.errosNaMateria != null && item.errosNaMateria > 0 && (
          <span className="text-xs text-slate-500">
            {item.errosNaMateria} erro{item.errosNaMateria > 1 ? "s" : ""} na prova
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

  const [{ plan, items }, ultimoExam] = await Promise.all([
    getPlanoAtual(session.userId),
    prisma.exam.findFirst({
      where: { userId: session.userId, provaId: { not: null } },
      orderBy: { data: "desc" },
      select: { id: true, nome: true },
    }),
  ]);

  const diagnostico = items.filter((i) => i.bloco === "diagnostico");
  const contexto = items.filter(
    (i) => i.bloco === "contexto" || i.bloco === "meta"
  );
  const analises = items.filter((i) => i.bloco === "analise_materia");
  const questsCount = items.filter(
    (i) => i.geraQuest !== false && i.duracaoMin > 0
  ).length;
  const horasQuests = Math.round(
    items
      .filter((i) => i.geraQuest !== false && i.duracaoMin > 0)
      .reduce((s, i) => s + i.duracaoMin, 0) / 60
  );

  const formatoNovo =
    diagnostico.length > 0 || analises.length > 0;
  const planoLegado = Boolean(plan) && !formatoNovo;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Plano desta semana</h1>
        <p className="text-slate-600">
          Leia o diagnóstico e a análise por matéria aqui. As atividades práticas ficam em{" "}
          <Link href="/quests" className="font-medium text-teal-700 hover:underline">
            Quests
          </Link>
          .
        </p>
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
            Registre um resultado em Provas públicas para gerar seu plano automaticamente.
          </p>
        </Card>
      ) : planoLegado && analises.length === 0 ? (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-sm text-amber-900">
            Este plano foi gerado no formato antigo. Clique abaixo para gerar o novo formato
            (diagnóstico + análise por matéria + quests).
          </p>
          {ultimoExam ? (
            <div className="mt-4">
              <RecalcularDiagnosticoButton examId={ultimoExam.id} />
              <p className="mt-2 text-xs text-amber-800">
                Com base em: <strong>{ultimoExam.nome}</strong>
              </p>
            </div>
          ) : (
            <LinkButton href="/provas" variant="primary" className="mt-4">
              Registrar prova no catálogo
            </LinkButton>
          )}
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
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">
                {item.descricao}
              </p>
            </Card>
          ))}

          {analises.length > 0 && (
            <section className="space-y-4">
              <h2 className="text-lg font-semibold text-slate-900">
                Análise por matéria
              </h2>
              <p className="text-sm text-slate-600">
                Visão geral do que a prova mostrou em cada área — sem micro-lista de tarefas
                (elas estão em Quests).
              </p>
              <div className="space-y-3">
                {analises.map((item) => (
                  <CardAnaliseMateria key={`${item.ordem}-${item.titulo}`} item={item} />
                ))}
              </div>
            </section>
          )}

          {questsCount > 0 && (
            <Card className="border-teal-200 bg-teal-50/40">
              <h3 className="font-semibold text-teal-900">Próximo passo</h3>
              <p className="mt-2 text-sm text-teal-900">
                {questsCount} atividade{questsCount > 1 ? "s" : ""} prática
                {horasQuests > 0 ? ` (~${horasQuests}h)` : ""} com base no que você errou e
                nas suas anotações.
              </p>
              <LinkButton href="/quests" className="mt-4">
                Abrir Quests
              </LinkButton>
            </Card>
          )}
        </>
      )}

      {ultimoExam && !planoLegado && (
        <div className="flex flex-wrap items-center gap-3 border-t border-slate-100 pt-4">
          <RecalcularDiagnosticoButton
            examId={ultimoExam.id}
            variant="secondary"
            label="Atualizar diagnóstico e plano"
          />
          <p className="text-xs text-slate-500">
            Use após classificar erros na prova para incorporar suas anotações.
          </p>
        </div>
      )}
    </div>
  );
}
