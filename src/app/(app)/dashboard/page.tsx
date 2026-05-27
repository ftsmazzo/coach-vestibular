import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/exam-service";
import { pctAcertoRegistro } from "@/lib/exam-stats";
import { getMateriaLabel } from "@/lib/taxonomy";
import { filtroRegistrosFromSearchParam } from "@/lib/prova-tipo";
import { Card, Button, Badge } from "@/components/ui";
import { EvolutionChart } from "@/components/evolution-chart";
import { FiltroRegistrosTabs } from "@/components/filtro-registros-tabs";
import { ResumoDiagnosticoCard } from "@/components/resumo-diagnostico";
import { DashboardHero } from "@/components/dashboard-hero";
import { JornadaResumoCard } from "@/components/jornada-resumo-card";
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
  const data = await getDashboardData(session.userId, filtro);
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
            Visão rápida do último resultado. O plano e as quests são o próximo passo depois do
            diagnóstico.
          </p>
        </div>
        <Link href="/provas">
          <Button>+ Registrar prova</Button>
        </Link>
      </div>

      <MensagemDiaCard />

      {filtro === "todos" && <JornadaResumoCard userId={session.userId} />}

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
            {data.counts.simulados === 0 && (
              <Link href="/provas?aba=simulados">
                <Button variant="ghost" className="text-xs">
                  Ver simulados
                </Button>
              </Link>
            )}
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
        <ResumoDiagnosticoCard
          resumo={scores.resumoProva as ResumoProvaDiagnostico}
          checkIn={latest?.checkInScore}
          compact
        />
      )}

      {snapshot?.mensagem && (
        <Card className="border-l-4 border-l-teal-500 bg-gradient-to-r from-teal-50/80 to-white">
          <p className="text-xs font-semibold uppercase tracking-wide text-teal-800">
            Leitura do coach
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
          <h2 className="mb-4 font-semibold text-slate-900">Por matéria</h2>
          <ul className="space-y-3">
            {scores?.materiaScores?.length ? (
              scores.materiaScores.map(
                (m: { materiaId: string; taxaAcerto: number; materiaLabel?: string }) => {
                  const pct = Math.round(m.taxaAcerto * 100);
                  return (
                    <li key={m.materiaId}>
                      <div className="flex justify-between text-sm">
                        <span className="font-medium text-slate-800">
                          {m.materiaLabel ?? getMateriaLabel(m.materiaId)}
                        </span>
                        <span className={pct >= 70 ? "text-emerald-700" : "text-slate-600"}>
                          {pct}%
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-slate-100">
                        <div
                          className={`h-full rounded-full ${pct >= 70 ? "bg-emerald-500" : "bg-teal-500"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                }
              )
            ) : (
              <li className="text-sm text-slate-500">Sem dados neste filtro.</li>
            )}
          </ul>
        </Card>
      </div>

      {data.quests.length > 0 && (
        <Card>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="font-semibold text-slate-900">Próximas quests</h2>
              <p className="text-sm text-slate-500">Tarefas do plano desta semana</p>
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
