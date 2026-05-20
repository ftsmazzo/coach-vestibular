import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getPlanoAtual } from "@/lib/plano-atual";
import { Card, Badge } from "@/components/ui";
import type { StudyPlanItem } from "@/lib/study-plan";

function SecaoPlano({
  titulo,
  subtitulo,
  items,
}: {
  titulo: string;
  subtitulo?: string;
  items: StudyPlanItem[];
}) {
  if (items.length === 0) return null;
  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">{titulo}</h2>
        {subtitulo && <p className="text-sm text-slate-600">{subtitulo}</p>}
      </div>
      <ol className="space-y-3">
        {items.map((item) => (
          <li key={`${item.ordem}-${item.titulo}`}>
            <Card
              className={
                item.bloco === "prioridade_materia"
                  ? "border-rose-200 bg-rose-50/40"
                  : item.bloco === "foco_profundo"
                    ? "border-teal-200 bg-teal-50/20"
                    : item.bloco === "consolidacao"
                      ? "border-amber-100 bg-amber-50/30"
                      : item.bloco === "integracao"
                        ? "border-indigo-100 bg-indigo-50/30"
                        : item.bloco === "contexto"
                          ? "border-slate-200 bg-slate-50/80"
                          : ""
              }
            >
              <div className="flex items-start gap-3">
                {item.duracaoMin > 0 && (
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-800">
                    {item.ordem}
                  </span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-slate-900">{item.titulo}</h3>
                    {item.bloco === "foco_profundo" && (
                      <Badge tone="danger">Profundo</Badge>
                    )}
                    {item.bloco === "consolidacao" && (
                      <Badge tone="warning">Consolidar</Badge>
                    )}
                    {item.bloco === "manutencao" && (
                      <Badge tone="success">Manter</Badge>
                    )}
                    {item.bloco === "integracao" && (
                      <Badge tone="neutral">Integrar</Badge>
                    )}
                    {item.errosNaMateria != null && item.errosNaMateria > 0 && (
                      <Badge tone="danger">
                        {item.errosNaMateria} erro{item.errosNaMateria > 1 ? "s" : ""}
                      </Badge>
                    )}
                  </div>
                  <p className="mt-1 whitespace-pre-line text-sm text-slate-600">
                    {item.descricao}
                  </p>
                  {item.duracaoMin > 0 && (
                    <p className="mt-2 text-xs font-medium text-slate-500">
                      ~{item.duracaoMin} min
                      {item.geraQuest !== false ? " · vira quest" : ""}
                    </p>
                  )}
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ol>
    </section>
  );
}

export default async function PlanoPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const { plan, items } = await getPlanoAtual(session.userId);

  const panorama = items.filter((i) => i.bloco === "contexto");
  const criticas = items.filter(
    (i) => i.bloco === "prioridade_materia" || i.bloco === "foco_profundo"
  );
  const consolidacao = items.filter((i) => i.bloco === "consolidacao");
  const manutencao = items.filter((i) => i.bloco === "manutencao");
  const integracao = items.filter((i) => i.bloco === "integracao");
  const meta = items.filter((i) => i.bloco === "meta");

  const horasEstimadas = Math.round(
    items.filter((i) => i.duracaoMin > 0).reduce((s, i) => s + i.duracaoMin, 0) / 60
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Plano desta semana</h1>
        <p className="text-slate-600">
          Plano <strong>completo</strong>: correção profunda onde mais falhou, consolidação nas
          outras matérias da prova, manutenção do que vai bem e integração (mini-simulado +
          caderno). Não é só lista de erros.
        </p>
        {plan && horasEstimadas > 0 && (
          <p className="mt-1 text-sm text-teal-800">
            Carga sugerida: ~{horasEstimadas}h na semana ({plan.recoveryMode ? "modo leve" : "ritmo normal"}).
          </p>
        )}
      </div>

      {plan?.recoveryMode && (
        <Card className="border-amber-200 bg-amber-50">
          <Badge tone="warning">Modo recuperação</Badge>
          <p className="mt-2 text-sm text-amber-900">
            Menos blocos, mas ainda com consolidação e integração — não só erros.
          </p>
        </Card>
      )}

      {!plan ? (
        <Card>
          <p className="text-slate-600">
            Registre um resultado em Provas públicas para gerar seu plano automaticamente.
          </p>
        </Card>
      ) : (
        <div className="space-y-8">
          <SecaoPlano titulo="1. Panorama" items={panorama} />
          <SecaoPlano
            titulo="2. Correção profunda (onde mais falhou)"
            subtitulo="4 passos por assunto: diagnóstico, teoria, prática, caderno."
            items={criticas}
          />
          <SecaoPlano
            titulo="3. Consolidar o restante da prova"
            subtitulo="Matérias que apareceram na prova e ainda precisam de base — não só as 2 piores."
            items={consolidacao}
          />
          <SecaoPlano
            titulo="4. Manter o que já está forte"
            subtitulo="Para o plano não ficar torto nem ignorar o que você já acerta."
            items={manutencao}
          />
          <SecaoPlano
            titulo="5. Integração"
            subtitulo="Amarrar tudo com prova cronometrada e caderno de correções."
            items={integracao}
          />
          <SecaoPlano titulo="6. Meta da semana" items={meta} />
        </div>
      )}

      <p className="text-xs text-slate-500">
        Em <strong>Quests</strong> aparecem os blocos com estudo ativo (profundo, consolidar,
        manter, integrar). Cabeçalhos e meta não viram quest. Atualize o plano no detalhe do seu
        registro se ainda vir tarefas rasas ou antigas.
      </p>
    </div>
  );
}
