import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/exam-service";
import { pctAcertoRegistro } from "@/lib/exam-stats";
import { getMateriaLabel } from "@/lib/taxonomy";
import {
  filtroRegistrosFromSearchParam,
  labelCategoriaRegistro,
  categoriaDoRegistro,
} from "@/lib/prova-tipo";
import { Card, Button, Badge } from "@/components/ui";
import { EvolutionChart } from "@/components/evolution-chart";
import { FiltroRegistrosTabs } from "@/components/filtro-registros-tabs";
import { ResumoDiagnosticoCard } from "@/components/resumo-diagnostico";
import type { ResumoProvaDiagnostico } from "@/lib/diagnosis-prova";

interface PageProps {
  searchParams: Promise<{ filtro?: string }>;
}

function CardUltimo({
  titulo,
  exam,
}: {
  titulo: string;
  exam: { nome: string; questionAttempts: { correto: boolean }[] } | undefined;
}) {
  const pct = exam ? pctAcertoRegistro(exam.questionAttempts) : null;
  return (
    <Card>
      <p className="text-sm text-slate-500">{titulo}</p>
      <p className="text-3xl font-bold text-teal-700">{pct != null ? `${pct}%` : "—"}</p>
      <p className="text-xs text-slate-500">{exam?.nome ?? "Nenhum ainda"}</p>
    </Card>
  );
}

export default async function DashboardPage({ searchParams }: PageProps) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { filtro: filtroParam } = await searchParams;
  const filtro = filtroRegistrosFromSearchParam(filtroParam);
  const data = await getDashboardData(session.userId, filtro);
  const latest = data.latest;
  const snapshot = latest?.diagnosticSnapshot;
  const scores = snapshot ? JSON.parse(snapshot.scoresJson) : null;
  const focos = snapshot ? JSON.parse(snapshot.focosJson) : [];
  const pctLatest = latest ? pctAcertoRegistro(latest.questionAttempts) : 0;

  const tituloUltimo =
    filtro === "provas"
      ? "Última prova oficial"
      : filtro === "simulados"
        ? "Último simulado"
        : "Último resultado";

  const tituloContagem =
    filtro === "provas"
      ? "Provas oficiais registradas"
      : filtro === "simulados"
        ? "Simulados registrados"
        : "Resultados registrados";

  const contagemValor =
    filtro === "todos" ? data.counts.todos : filtro === "provas" ? data.counts.provas : data.counts.simulados;

  const subtituloContagem =
    filtro === "todos"
      ? `${data.counts.provas} prova${data.counts.provas !== 1 ? "s" : ""} · ${data.counts.simulados} simulado${data.counts.simulados !== 1 ? "s" : ""}`
      : undefined;

  const tituloEvolucao =
    filtro === "provas"
      ? "Evolução — provas oficiais"
      : filtro === "simulados"
        ? "Evolução — simulados"
        : "Evolução — todos os resultados";

  const tituloMateria =
    filtro === "provas"
      ? "Por matéria (últimas provas)"
      : filtro === "simulados"
        ? "Por matéria (últimos simulados)"
        : "Por matéria (últimos resultados)";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600">
            Provas oficiais (ENEM, vestibular) definem focos; simulados mostram se você está
            evoluindo nesses temas.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/provas">
            <Button>Provas públicas</Button>
          </Link>
          <Link href="/simulados">
            <Button variant="secondary">Últimos resultados</Button>
          </Link>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white/80 p-4">
        <FiltroRegistrosTabs basePath="/dashboard" filtro={filtro} counts={data.counts} />
      </div>

      {filtro === "todos" ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <CardUltimo titulo="Última prova oficial" exam={data.latestProva} />
          <CardUltimo titulo="Último simulado" exam={data.latestSimulado} />
          <Card>
            <p className="text-sm text-slate-500">Total de registros</p>
            <p className="text-3xl font-bold text-slate-800">{data.counts.todos}</p>
            <p className="text-xs text-slate-500">
              {data.counts.provas} prova{data.counts.provas !== 1 ? "s" : ""} · {data.counts.simulados}{" "}
              simulado{data.counts.simulados !== 1 ? "s" : ""}
            </p>
          </Card>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <p className="text-sm text-slate-500">{tituloUltimo}</p>
            <p className="text-3xl font-bold text-teal-700">
              {latest ? `${pctLatest}%` : "—"}
            </p>
            <p className="text-xs text-slate-500">{latest?.nome ?? "Nenhum ainda"}</p>
            {latest && (
              <div className="mt-2">
                <Badge tone="neutral">
                  {labelCategoriaRegistro(categoriaDoRegistro(latest))}
                </Badge>
              </div>
            )}
          </Card>
          <Card>
            <p className="text-sm text-slate-500">{tituloContagem}</p>
            <p className="text-3xl font-bold text-slate-800">{contagemValor}</p>
            {subtituloContagem && (
              <p className="text-xs text-slate-500">{subtituloContagem}</p>
            )}
          </Card>
          <Card>
            <p className="text-sm text-slate-500">Streak</p>
            <p className="text-3xl font-bold text-slate-800">{data.streak} dias</p>
          </Card>
        </div>
      )}

      {latest?.recoveryMode && (
        <Card className="border-amber-200 bg-amber-50">
          <Badge tone="warning">Modo recuperação</Badge>
          <p className="mt-2 text-sm text-amber-900">
            Metas reduzidas esta semana. Um resultado difícil não define seu vestibular.
          </p>
        </Card>
      )}

      {scores?.resumoProva && (
        <ResumoDiagnosticoCard
          resumo={scores.resumoProva as ResumoProvaDiagnostico}
          checkIn={latest?.checkInScore}
        />
      )}

      {snapshot && (
        <Card>
          <h2 className="mb-2 font-semibold text-slate-900">Leitura do coach</h2>
          <p className="text-slate-700">{snapshot.mensagem}</p>
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

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 font-semibold">{tituloEvolucao}</h2>
          <EvolutionChart
            data={data.evolution}
            emptyMessage={
              filtro === "provas"
                ? "Registre provas oficiais para ver a evolução."
                : filtro === "simulados"
                  ? "Registre simulados para ver a evolução."
                  : "Registre provas ou simulados para ver a evolução."
            }
          />
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">{tituloMateria}</h2>
          <ul className="space-y-2">
            {scores?.materiaScores?.map(
              (m: { materiaId: string; taxaAcerto: number; materiaLabel?: string }) => (
                <li key={m.materiaId} className="flex justify-between text-sm">
                  <span>{m.materiaLabel ?? getMateriaLabel(m.materiaId)}</span>
                  <span className="font-medium">{Math.round(m.taxaAcerto * 100)}%</span>
                </li>
              )
            ) ?? <li className="text-slate-500">Sem dados neste filtro</li>}
          </ul>
          {scores?.materiaScores && (
            <div className="mt-4 text-sm">
              <p className="font-medium text-emerald-700">Destaques</p>
              <p className="text-slate-600">
                {scores.materiaScores
                  .filter((m: { taxaAcerto: number }) => m.taxaAcerto >= 0.7)
                  .map((m: { materiaLabel: string }) => m.materiaLabel)
                  .join(", ") || "Continue registrando para ver padrões."}
              </p>
            </div>
          )}
        </Card>
      </div>

      {data.quests.length > 0 && (
        <Card>
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Quests pendentes</h2>
            <Link href="/quests">
              <Button variant="ghost">Ver todas</Button>
            </Link>
          </div>
          <ul className="mt-3 space-y-2">
            {data.quests.slice(0, 3).map((q) => (
              <li key={q.id} className="text-sm text-slate-700">
                • {q.titulo}
              </li>
            ))}
          </ul>
        </Card>
      )}

      <div className="flex gap-3">
        <Link href="/plano">
          <Button variant="secondary">Ver plano semanal</Button>
        </Link>
        <Link href={`/simulados${filtro !== "todos" ? `?filtro=${filtro}` : ""}`}>
          <Button variant="ghost">Últimos resultados</Button>
        </Link>
      </div>
    </div>
  );
}
