import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/exam-service";
import { buildJornadaDashboardAnalytics } from "@/lib/jornada-analytics";
import { pctAcertoRegistro } from "@/lib/exam-stats";
import { filtroRegistrosFromSearchParam } from "@/lib/prova-tipo";
import { Card, Button, Badge } from "@/components/ui";
import { EvolutionChart } from "@/components/evolution-chart";
import { FiltroRegistrosTabs } from "@/components/filtro-registros-tabs";
import { ResumoDiagnosticoCard } from "@/components/resumo-diagnostico";
import { DashboardHero } from "@/components/dashboard-hero";
import { DashboardRegistrosGrid } from "@/components/dashboard-registros-grid";
import { MateriaJornadaCharts } from "@/components/materia-jornada-charts";
import { JornadaResumoCard } from "@/components/jornada-resumo-card";
import { RankingCard } from "@/components/ranking-card";
import { MensagemDiaCard } from "@/components/mensagem-dia";
import type { ResumoProvaDiagnostico } from "@/lib/diagnosis-prova";

interface PageProps {
  searchParams: Promise<{ filtro?: string }>;
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role === "ADMIN") redirect("/admin");

  const { filtro: filtroParam } = await searchParams;
  const filtro = filtroRegistrosFromSearchParam(filtroParam);
  const [data, analytics] = await Promise.all([
    getDashboardData(session.userId, filtro),
    buildJornadaDashboardAnalytics(session.userId, filtro),
  ]);

  const latest = data.latest;
  const snapshot = latest?.diagnosticSnapshot;
  const scores = snapshot ? JSON.parse(snapshot.scoresJson) : null;
  const focos = snapshot ? JSON.parse(snapshot.focosJson) : [];
  const pctLatest = latest ? pctAcertoRegistro(latest.questionAttempts) : 0;

  const examHero = latest
    ? {
        id: latest.id,
        nome: latest.nome,
        data: latest.data,
        provaId: latest.provaId,
        prova: latest.prova,
        questionAttempts: latest.questionAttempts,
      }
    : undefined;

  const tituloEvolucao =
    filtro === "provas"
      ? "Evolução nas provas oficiais"
      : filtro === "simulados"
        ? "Evolução nos simulados"
        : "Sua evolução";

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-teal-700">Olá, {session.name.split(" ")[0]}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Seu painel
          </h1>
          <p className="mt-1 max-w-xl text-sm text-slate-600">
            Visão da <strong>jornada inteira</strong> — oficiais, simulados e listas. O plano da
            semana usa todos os seus registros, não só o último.
          </p>
        </div>
        <Link href="/provas">
          <Button>+ Registrar prova</Button>
        </Link>
      </div>

      <MensagemDiaCard />

      {filtro === "todos" && analytics.totalRegistros > 0 && (
        <Card className="border-teal-200 bg-gradient-to-r from-teal-50 to-white">
          <p className="text-xs font-semibold uppercase text-teal-800">Jornada completa</p>
          <p className="mt-1 text-3xl font-bold text-slate-900">
            {analytics.pctGlobalPonderado}%{" "}
            <span className="text-lg font-normal text-slate-600">acerto ponderado</span>
          </p>
          <p className="mt-1 text-sm text-slate-600">
            {analytics.totalRegistros} registros · média de todas as aplicações
          </p>
        </Card>
      )}

      {filtro === "todos" && (
        <div className="grid gap-4 lg:grid-cols-2">
          <JornadaResumoCard userId={session.userId} />
          <RankingCard userId={session.userId} />
        </div>
      )}

      {analytics.registrosRecentes.length > 0 && (
        <DashboardRegistrosGrid registros={analytics.registrosRecentes} />
      )}

      <DashboardHero exam={examHero} pct={pctLatest} counts={data.counts} />

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="mb-3 text-xs font-medium uppercase tracking-wide text-slate-500">
          Filtrar visão
        </p>
        <FiltroRegistrosTabs basePath="/dashboard" filtro={filtro} counts={data.counts} />
      </div>

      {filtro === "todos" && data.counts.todos > 0 && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Card className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm text-slate-500">Último simulado</p>
              <p className="text-lg font-semibold text-slate-800">
                {data.latestSimulado
                  ? `${pctAcertoRegistro(data.latestSimulado.questionAttempts)}%`
                  : "—"}
              </p>
              <p className="text-xs text-slate-500 truncate max-w-[200px]">
                {data.latestSimulado?.nome ?? "Nenhum ainda"}
              </p>
            </div>
          </Card>
          <Card className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm text-slate-500">Streak de estudo</p>
              <p className="text-lg font-semibold text-slate-800">{data.streak} dias</p>
              <p className="text-xs text-slate-500">com registro de resultado</p>
            </div>
          </Card>
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

      {scores?.resumoProva && (
        <div>
          <p className="mb-2 text-xs text-slate-500">Último registro em detalhe</p>
          <ResumoDiagnosticoCard
            resumo={scores.resumoProva as ResumoProvaDiagnostico}
            checkIn={latest?.checkInScore}
            compact
          />
        </div>
      )}

      {snapshot?.mensagem && (
        <Card className="border-l-4 border-l-teal-500 bg-gradient-to-r from-teal-50/80 to-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
            Leitura do coach (último registro)
          </p>
          <p className="mt-2 text-slate-700 leading-relaxed">{snapshot.mensagem}</p>
          {!scores?.resumoProva && focos.length > 0 && (
            <div className="mt-4 flex flex-wrap gap-2">
              {focos.map((f: { label: string; prioridade: string }, i: number) => (
                <Badge key={i} tone={f.prioridade === "alta" ? "danger" : "warning"}>
                  {f.label}
                </Badge>
              ))}
            </div>
          )}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <h2 className="mb-1 font-semibold text-slate-900">{tituloEvolucao}</h2>
          <p className="mb-4 text-xs text-slate-500">Percentual de acertos por data de aplicação</p>
          <EvolutionChart
            data={data.evolution}
            emptyMessage="Registre mais provas para ver a linha de evolução."
          />
        </Card>
        <Card className="lg:col-span-2">
          <MateriaJornadaCharts
            materiasMedia={analytics.materiasMedia}
            seriesPorProva={analytics.seriesPorProva}
            materiaIdsOrdenados={analytics.materiaIdsOrdenados}
          />
        </Card>
      </div>

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
