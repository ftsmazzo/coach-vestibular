import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, Badge } from "@/components/ui";
import type { StudyPlanItem } from "@/lib/study-plan";

export default async function PlanoPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const plan = await prisma.studyPlan.findFirst({
    where: { userId: session.userId },
    orderBy: { createdAt: "desc" },
  });

  const items: StudyPlanItem[] = plan ? JSON.parse(plan.itemsJson) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Plano desta semana</h1>
        <p className="text-slate-600">Máximo de focos priorizados — sem sobrecarga.</p>
      </div>

      {plan?.recoveryMode && (
        <Card className="border-amber-200 bg-amber-50">
          <Badge tone="warning">Modo recuperação</Badge>
          <p className="mt-2 text-sm text-amber-900">
            Metas menores e revisão leve. Consistência importa mais que intensidade agora.
          </p>
        </Card>
      )}

      {!plan ? (
        <Card>
          <p className="text-slate-600">
            Registre um simulado para gerar seu plano automaticamente.
          </p>
        </Card>
      ) : (
        <ol className="space-y-4">
          {items.map((item) => (
            <li key={item.ordem}>
              <Card>
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-100 text-sm font-bold text-teal-800">
                    {item.ordem}
                  </span>
                  <div>
                    <h2 className="font-semibold text-slate-900">{item.titulo}</h2>
                    <p className="mt-1 text-sm text-slate-600">{item.descricao}</p>
                    {item.conhecimentoExigido && (
                      <p className="mt-2 text-xs text-teal-800">
                        Da prova: {item.conhecimentoExigido}
                      </p>
                    )}
                    <p className="mt-2 text-xs text-slate-500">
                      ~{item.duracaoMin} min
                      {item.nivelDificuldade ? ` · ${item.nivelDificuldade}` : ""}
                    </p>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ol>
      )}

      <p className="text-xs text-slate-500">
        As quests são criadas automaticamente a partir dos focos (exceto meta transversal).
        Veja em Quests.
      </p>
    </div>
  );
}
