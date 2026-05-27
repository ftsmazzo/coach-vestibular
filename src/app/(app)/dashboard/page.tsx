import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/exam-service";
import { buildJornadaDashboardAnalytics } from "@/lib/jornada-analytics";
import { buildResumoGlobalJornada } from "@/lib/jornada";
import { buildMetacognicaoGlobalJornada } from "@/lib/jornada-metacognicao";
import { Card, Button, Badge } from "@/components/ui";
import { ResumoDiagnosticoCard } from "@/components/resumo-diagnostico";
import { DashboardRegistrosGrid } from "@/components/dashboard-registros-grid";
import { CoachPanoramaJornada } from "@/components/coach-panorama-jornada";
import { ComunidadeDashboardBanner } from "@/components/comunidade-dashboard-banner";
import { JornadaResumoCard } from "@/components/jornada-resumo-card";
import { MensagemDiaCard } from "@/components/mensagem-dia";
import { MetacognicaoJornadaCard } from "@/components/metacognicao-jornada-card";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "ADMIN") redirect("/admin");

  const [data, analytics, resumoGlobal, metacognicao] = await Promise.all([
    getDashboardData(session.userId, "todos"),
    buildJornadaDashboardAnalytics(session.userId, "todos"),
    buildResumoGlobalJornada(session.userId, "todos"),
    buildMetacognicaoGlobalJornada(session.userId),
  ]);

  const latest = data.latest;

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <p className="text-sm font-medium text-teal-700">Olá, {session.name.split(" ")[0]}</p>
        <Link href="/provas" className="w-full sm:w-auto">
          <Button className="w-full sm:w-auto">+ Registrar atividade</Button>
        </Link>
      </div>

      <ComunidadeDashboardBanner userId={session.userId} />

      <MensagemDiaCard />

      {analytics.totalRegistros > 0 && (
        <CoachPanoramaJornada analytics={analytics} evolucao={data.evolution} />
      )}

      <JornadaResumoCard userId={session.userId} />

      {analytics.registrosRecentes.length > 0 ? (
        <DashboardRegistrosGrid registros={analytics.registrosRecentes} />
      ) : (
        <div className="rounded-xl border border-dashed border-teal-200 bg-teal-50/40 p-6 text-center">
          <p className="text-sm text-slate-700">Nenhum registro ainda.</p>
          <Link href="/provas" className="mt-3 inline-block">
            <Button>Registrar primeira atividade</Button>
          </Link>
        </div>
      )}

      {latest?.recoveryMode && (
        <Card className="border-amber-200 bg-amber-50">
          <Badge tone="warning">Modo recuperação</Badge>
          <p className="mt-2 text-sm text-amber-900">
            Plano mais leve esta semana — um resultado difícil não define seu vestibular.
          </p>
        </Card>
      )}

      {resumoGlobal && (
        <div>
          <p className="mb-2 text-xs text-slate-500">Resumo global da jornada</p>
          <ResumoDiagnosticoCard resumo={resumoGlobal} compact escopoJornada />
        </div>
      )}

      {metacognicao && <MetacognicaoJornadaCard dados={metacognicao} />}

      {data.quests.length > 0 && (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Próximas quests</h2>
              <p className="text-sm text-slate-500">Plano global da semana (jornada agregada)</p>
            </div>
            <Link href="/quests">
              <Button variant="secondary">Abrir quests</Button>
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {data.quests.slice(0, 3).map((q, i) => (
              <li
                key={q.id}
                className="flex items-center gap-3 rounded-lg border border-slate-100 bg-slate-50/50 px-3 py-2 text-sm"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-teal-600 text-xs font-bold text-white">
                  {i + 1}
                </span>
                <span className="font-medium text-slate-800">{q.titulo}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
