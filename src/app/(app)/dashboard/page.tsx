import Link from "next/link";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getDashboardData } from "@/lib/exam-service";
import { getMateriaLabel } from "@/lib/taxonomy";
import { Card, Button, Badge } from "@/components/ui";
import { EvolutionChart } from "@/components/evolution-chart";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const data = await getDashboardData(session.userId);
  const latest = data.latest;
  const snapshot = latest?.diagnosticSnapshot;
  const scores = snapshot ? JSON.parse(snapshot.scoresJson) : null;
  const focos = snapshot ? JSON.parse(snapshot.focosJson) : [];

  const totalLatest = latest?.questionAttempts.length ?? 0;
  const acertosLatest = latest?.questionAttempts.filter((q) => q.correto).length ?? 0;
  const pctLatest = totalLatest > 0 ? Math.round((acertosLatest / totalLatest) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
          <p className="text-slate-600">Sua evolução importa mais que um simulado isolado.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/provas">
            <Button>Provas públicas</Button>
          </Link>
          <Link href="/simulados">
            <Button variant="secondary">Meus registros</Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <p className="text-sm text-slate-500">Último simulado</p>
          <p className="text-3xl font-bold text-teal-700">{pctLatest}%</p>
          <p className="text-xs text-slate-500">{latest?.nome ?? "Nenhum ainda"}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Simulados registrados</p>
          <p className="text-3xl font-bold text-slate-800">{data.exams.length}</p>
        </Card>
        <Card>
          <p className="text-sm text-slate-500">Streak</p>
          <p className="text-3xl font-bold text-slate-800">{data.streak} dias</p>
        </Card>
      </div>

      {latest?.recoveryMode && (
        <Card className="border-amber-200 bg-amber-50">
          <Badge tone="warning">Modo recuperação</Badge>
          <p className="mt-2 text-sm text-amber-900">
            Metas reduzidas esta semana. Um simulado difícil não define seu vestibular.
          </p>
        </Card>
      )}

      {snapshot && (
        <Card>
          <h2 className="mb-2 font-semibold text-slate-900">Diagnóstico</h2>
          <p className="text-slate-700">{snapshot.mensagem}</p>
          {focos.length > 0 && (
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
          <h2 className="mb-4 font-semibold">Evolução</h2>
          <EvolutionChart data={data.evolution} />
        </Card>
        <Card>
          <h2 className="mb-4 font-semibold">Por matéria (últimos simulados)</h2>
          <ul className="space-y-2">
            {scores?.materiaScores?.map(
              (m: { materiaId: string; taxaAcerto: number; materiaLabel?: string }) => (
                <li key={m.materiaId} className="flex justify-between text-sm">
                  <span>{m.materiaLabel ?? getMateriaLabel(m.materiaId)}</span>
                  <span className="font-medium">{Math.round(m.taxaAcerto * 100)}%</span>
                </li>
              )
            ) ?? <li className="text-slate-500">Sem dados</li>}
          </ul>
          {scores?.materiaScores && (
            <div className="mt-4 text-sm">
              <p className="font-medium text-emerald-700">Destaques</p>
              <p className="text-slate-600">
                {scores.materiaScores
                  .filter((m: { taxaAcerto: number }) => m.taxaAcerto >= 0.7)
                  .map((m: { materiaLabel: string }) => m.materiaLabel)
                  .join(", ") || "Continue registrando simulados para ver padrões."}
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
        <Link href="/simulados">
          <Button variant="ghost">Histórico</Button>
        </Link>
      </div>
    </div>
  );
}
